import { Skill } from '../types';

/**
 * Rule-based duplicate detection (§七). First version: heuristics only,
 * no vector DB. Marks skills as *suspected* duplicates — NEVER auto-merges.
 *
 * Rules:
 *   1. Name similarity (normalized equality or high token overlap)
 *   2. Same-directory duplicate (two skills rooted in one folder)
 *   3. Description similarity (token Jaccard)
 *   4. Same category + overlapping name keywords
 *   5. README.md and skill.md both detected as separate skills
 *   6. Chinese-aware: CJK bigram similarity + weak-suffix stripping
 */

export interface DuplicateGroup {
  groupId: string;
  reason: string;
  skillIds: string[];
}

export interface DuplicateResult {
  groups: DuplicateGroup[];
  /** skillId -> groupId (only for skills in groups of size >= 2) */
  assignment: Record<string, string>;
  /** skillId -> human-readable reasons */
  reasons: Record<string, string[]>;
}

/** Weak suffixes to strip before Chinese name comparison (§四). */
const WEAK_NAME_SUFFIXES = [
  '生成', '整理', '工具', '脚本', '助手', '模板', '管理', '管理器', '面板',
  'generator', 'tool', 'helper', 'manager', 'panel', 'template',
];

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_.\s]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tokens(s: string): Set<string> {
  return new Set(normalizeName(s).split('-').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function parentDir(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx) : '';
}

function baseName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

/** Strip weak suffixes so "知识卡片生成" vs "知识卡片整理" compare equal. */
function stripWeakSuffix(name: string): string {
  let result = name;
  for (const suffix of WEAK_NAME_SUFFIXES) {
    if (result.toLowerCase().endsWith(suffix)) {
      result = result.slice(0, result.length - suffix.length);
      break;
    }
  }
  return result.trim();
}

/** Extract CJK bigrams for Chinese-aware similarity (§四). */
function cjkBigrams(s: string): Set<string> {
  // CJK Unified Ideographs range
  const cjkFiltered = s.replace(/[^\u4e00-\u9fff]/g, '');
  const bigrams = new Set<string>();
  for (let i = 0; i < cjkFiltered.length - 1; i++) {
    bigrams.add(cjkFiltered.slice(i, i + 2));
  }
  return bigrams;
}

/** Check if one name contains the other after weak-suffix stripping. */
function nameContains(a: string, b: string): boolean {
  const sa = stripWeakSuffix(a);
  const sb = stripWeakSuffix(b);
  if (sa.length < 2 || sb.length < 2) return false;
  return sa !== sb && (sa.includes(sb) || sb.includes(sa));
}

/** Trivial union-find over skill ids. */
class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function detectDuplicates(skills: Skill[]): DuplicateResult {
  const uf = new UnionFind();
  const reasons: Record<string, Set<string>> = {};
  const inDup = new Set<string>();

  const addReason = (id: string, r: string) => {
    if (!reasons[id]) reasons[id] = new Set();
    reasons[id].add(r);
  };

  const active = skills.filter((s) => s.is_archived === 0);

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      let isDup = false;

      // Rule 1: name similarity
      const na = normalizeName(a.name);
      const nb = normalizeName(b.name);
      if (na.length > 0 && na === nb) {
        isDup = true;
        addReason(a.id, '名称相同');
        addReason(b.id, '名称相同');
      } else if (na.length > 1 && nb.length > 1) {
        const sim = jaccard(tokens(a.name), tokens(b.name));
        if (sim >= 0.7) {
          isDup = true;
          addReason(a.id, `名称相似 ${Math.round(sim * 100)}%`);
          addReason(b.id, `名称相似 ${Math.round(sim * 100)}%`);
        }
      }

      // Rule 1b (§四): name containment after weak-suffix strip
      if (!isDup && nameContains(a.name, b.name)) {
        isDup = true;
        addReason(a.id, '名称包含关系');
        addReason(b.id, '名称包含关系');
      }

      // Rule 1c (§四): CJK bigram similarity for Chinese names
      if (!isDup) {
        const ba = cjkBigrams(a.name);
        const bb = cjkBigrams(b.name);
        if (ba.size >= 2 && bb.size >= 2) {
          const bigramSim = jaccard(ba, bb);
          if (bigramSim >= 0.65) {
            isDup = true;
            addReason(a.id, `中文名称相似 ${Math.round(bigramSim * 100)}%`);
            addReason(b.id, `中文名称相似 ${Math.round(bigramSim * 100)}%`);
          }
        }
      }

      // Rule 2 & 5: same directory (esp. README + skill.md double detection)
      const da = parentDir(a.path);
      const db = parentDir(b.path);
      if (da.length > 0 && da === db) {
        const fa = baseName(a.path).toLowerCase();
        const fb = baseName(b.path).toLowerCase();
        const readmePair =
          (fa.includes('readme') && fb.includes('skill.md')) ||
          (fb.includes('readme') && fa.includes('skill.md'));
        isDup = true;
        const r = readmePair ? 'README.md 与 skill.md 疑似重复识别' : '同目录重复';
        addReason(a.id, r);
        addReason(b.id, r);
      }

      // Rule 3: description similarity (token Jaccard, §四 also adds CJK bigrams)
      if (
        a.description && b.description &&
        a.description.length > 10 && b.description.length > 10
      ) {
        const tokenSim = jaccard(tokens(a.description), tokens(b.description));
        const baDesc = cjkBigrams(a.description);
        const bbDesc = cjkBigrams(b.description);
        const bigramSim = baDesc.size >= 3 && bbDesc.size >= 3
          ? jaccard(baDesc, bbDesc)
          : 0;
        const bestSim = Math.max(tokenSim, bigramSim);
        if (bestSim >= 0.6) {
          isDup = true;
          addReason(a.id, `描述相似 ${Math.round(bestSim * 100)}%`);
          addReason(b.id, `描述相似 ${Math.round(bestSim * 100)}%`);
        }
      }

      // Rule 4: same category + name keyword overlap
      if (a.category && b.category && a.category === b.category) {
        const sim = jaccard(tokens(a.name), tokens(b.name));
        if (sim >= 0.5) {
          isDup = true;
          addReason(a.id, `同分类+名称重叠 ${Math.round(sim * 100)}%`);
          addReason(b.id, `同分类+名称重叠 ${Math.round(sim * 100)}%`);
        }
      }

      if (isDup) {
        uf.union(a.id, b.id);
        inDup.add(a.id);
        inDup.add(b.id);
      }
    }
  }

  // Bucket by union root
  const buckets = new Map<string, string[]>();
  for (const id of inDup) {
    const root = uf.find(id);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(id);
  }

  const groups: DuplicateGroup[] = [];
  const assignment: Record<string, string> = {};
  for (const [, ids] of buckets) {
    if (ids.length < 2) continue; // singleton — not a duplicate
    const groupId = `dup-${ids[0].slice(0, 8)}`;
    const reasonSet = new Set<string>();
    for (const id of ids) {
      assignment[id] = groupId;
      reasons[id]?.forEach((r) => reasonSet.add(r));
    }
    groups.push({
      groupId,
      reason: Array.from(reasonSet).join(' / '),
      skillIds: ids,
    });
  }

  return {
    groups,
    assignment,
    reasons: Object.fromEntries(
      Object.entries(reasons).map(([k, v]) => [k, Array.from(v)]),
    ),
  };
}
