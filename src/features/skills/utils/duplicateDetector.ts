import { Skill } from '../types';

/**
 * Rule-based duplicate detection (§七). Heuristics only, no vector DB.
 * Marks skills as *suspected* duplicates — NEVER auto-merges.
 *
 * Convergence rules (v2): Only flag duplicates when two skills share the
 * SAME source directory (same skill_source.id). The same Skill installed
 * in multiple client directories (Codex / Claude / WorkBuddy) is expected
 * multi-install behavior, NOT a duplicate.
 *
 * Additional rules within the same source:
 *   1. Same name (exact match after normalization)
 *   2. Same directory (README.md + SKILL.md double detection)
 *   3. Name containment after weak-suffix strip (Chinese-aware)
 *   4. CJK bigram similarity >= 0.85 (strict, was 0.65)
 *   5. Description similarity >= 0.8 (strict, was 0.6) — only within same source
 */

export interface DuplicateGroup {
  groupId: string;
  reason: string;
  skillIds: string[];
}

export interface DuplicateResult {
  groups: DuplicateGroup[];
  assignment: Record<string, string>;
  reasons: Record<string, string[]>;
}

const WEAK_NAME_SUFFIXES = [
  '生成', '整理', '工具', '脚本', '助手', '模板', '管理', '管理器', '面板',
  'generator', 'tool', 'helper', 'manager', 'panel', 'template',
];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[-_.\s]+/g, '-').replace(/^-|-$/g, '');
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

function cjkBigrams(s: string): Set<string> {
  const cjkFiltered = s.replace(/[^\u4e00-\u9fff]/g, '');
  const bigrams = new Set<string>();
  for (let i = 0; i < cjkFiltered.length - 1; i++) {
    bigrams.add(cjkFiltered.slice(i, i + 2));
  }
  return bigrams;
}

function nameContains(a: string, b: string): boolean {
  const sa = stripWeakSuffix(a);
  const sb = stripWeakSuffix(b);
  if (sa.length < 3 || sb.length < 3) return false;
  return sa !== sb && (sa.includes(sb) || sb.includes(sa));
}

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

      // Same-source gate: only compare skills from the same skill_source.
      if (a.source_id !== b.source_id) continue;

      let isDup = false;

      // Rule 1: exact name match
      const na = normalizeName(a.name);
      const nb = normalizeName(b.name);
      if (na.length > 0 && na === nb) {
        isDup = true;
        addReason(a.id, '名称相同');
        addReason(b.id, '名称相同');
      }

      // Rule 2: same directory (README + SKILL.md double detection)
      const da = parentDir(a.path);
      const db = parentDir(b.path);
      if (da.length > 0 && da === db) {
        isDup = true;
        const fa = baseName(a.path).toLowerCase();
        const fb = baseName(b.path).toLowerCase();
        const readmePair =
          (fa.includes('readme') && fb.includes('skill.md')) ||
          (fb.includes('readme') && fa.includes('skill.md'));
        addReason(a.id, readmePair ? 'README.md 与 skill.md 重复识别' : '同目录重复');
        addReason(b.id, readmePair ? 'README.md 与 skill.md 重复识别' : '同目录重复');
      }

      // Rule 3: name containment (strict, same source only)
      if (!isDup && nameContains(a.name, b.name)) {
        isDup = true;
        addReason(a.id, '名称包含关系');
        addReason(b.id, '名称包含关系');
      }

      // Rule 4: CJK bigram (strict 0.85, same source only)
      if (!isDup) {
        const ba = cjkBigrams(a.name);
        const bb = cjkBigrams(b.name);
        if (ba.size >= 2 && bb.size >= 2) {
          const bigramSim = jaccard(ba, bb);
          if (bigramSim >= 0.85) {
            isDup = true;
            addReason(a.id, `中文名称高度相似 ${Math.round(bigramSim * 100)}%`);
            addReason(b.id, `中文名称高度相似 ${Math.round(bigramSim * 100)}%`);
          }
        }
      }

      // Rule 5: description similarity (strict 0.8, same source only)
      if (!isDup && a.description && b.description &&
          a.description.length > 20 && b.description.length > 20) {
        const tokenSim = jaccard(tokens(a.description), tokens(b.description));
        const baDesc = cjkBigrams(a.description);
        const bbDesc = cjkBigrams(b.description);
        const bigramSim = baDesc.size >= 5 && bbDesc.size >= 5
          ? jaccard(baDesc, bbDesc)
          : 0;
        if (Math.max(tokenSim, bigramSim) >= 0.8) {
          isDup = true;
          addReason(a.id, `描述高度相似 ${Math.round(Math.max(tokenSim, bigramSim) * 100)}%`);
          addReason(b.id, `描述高度相似 ${Math.round(Math.max(tokenSim, bigramSim) * 100)}%`);
        }
      }

      if (isDup) {
        uf.union(a.id, b.id);
        inDup.add(a.id);
        inDup.add(b.id);
      }
    }
  }

  const buckets = new Map<string, string[]>();
  for (const id of inDup) {
    const root = uf.find(id);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(id);
  }

  const groups: DuplicateGroup[] = [];
  const assignment: Record<string, string> = {};
  for (const [, ids] of buckets) {
    if (ids.length < 2) continue;
    const groupId = `dup-${ids[0].slice(0, 8)}`;
    const reasonSet = new Set<string>();
    for (const id of ids) {
      assignment[id] = groupId;
      reasons[id]?.forEach((r) => reasonSet.add(r));
    }
    groups.push({ groupId, reason: Array.from(reasonSet).join(' / '), skillIds: ids });
  }

  return {
    groups,
    assignment,
    reasons: Object.fromEntries(
      Object.entries(reasons).map(([k, v]) => [k, Array.from(v)]),
    ),
  };
}
