import type { Skill } from '@/features/skills/types';
import type { AnalyticsOverview } from '@/features/local-assets/types';
import type { DuplicateResult } from '@/features/skills/utils/duplicateDetector';
import type { GovernanceSuggestion } from '../types';

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;

export function analyzeSkillRules(
  skills: Skill[],
  dupResult: DuplicateResult | null,
  _analytics: AnalyticsOverview | null,
): GovernanceSuggestion[] {
  const active = skills.filter((s) => s.is_archived === 0);
  const suggestions: GovernanceSuggestion[] = [];

  // Rule 1: missing description
  const missingDesc = active.filter((s) => !s.description);
  if (missingDesc.length > 0) {
    suggestions.push({
      id: 'skill.missing_description',
      title: `有 ${missingDesc.length} 个 Skills 缺少描述`,
      reason: '缺少描述的 Skills 难以被 AI 客户端理解和引用，建议优先补全。',
      severity: 'warning',
      resource_type: 'skill',
      resource_id: null,
      resource_count: missingDesc.length,
      action_label: '去补全描述',
      action_target: '/skills',
      can_create_proposal: true,
      rule_id: 'skill.missing_description',
    });
  }

  // Rule 2: missing category
  const missingCat = active.filter((s) => !s.category);
  if (missingCat.length > 0) {
    suggestions.push({
      id: 'skill.missing_category',
      title: `有 ${missingCat.length} 个 Skills 未分类`,
      reason: '未分类的 Skills 在筛选和搜索中难以被发现。',
      severity: 'info',
      resource_type: 'skill',
      resource_id: null,
      resource_count: missingCat.length,
      action_label: '去设置分类',
      action_target: '/skills',
      can_create_proposal: true,
      rule_id: 'skill.missing_category',
    });
  }

  // Rule 3: needs review
  const needsReview = active.filter((s) => s.needs_review === 1);
  if (needsReview.length > 0) {
    suggestions.push({
      id: 'skill.needs_review',
      title: `有 ${needsReview.length} 个 Skills 待整理`,
      reason: '这些 Skills 被标记为需要整理，可能包含过时或不准确的信息。',
      severity: 'warning',
      resource_type: 'skill',
      resource_id: null,
      resource_count: needsReview.length,
      action_label: '去整理',
      action_target: '/skills',
      can_create_proposal: false,
      rule_id: 'skill.needs_review',
    });
  }

  // Rule 4: needs improvement
  const needsImprovement = active.filter((s) => s.needs_improvement === 1);
  if (needsImprovement.length > 0) {
    suggestions.push({
      id: 'skill.needs_improvement',
      title: `有 ${needsImprovement.length} 个 Skills 待进化`,
      reason: '这些 Skills 被标记为需要进化，可能需要增强内容或改进结构。',
      severity: 'info',
      resource_type: 'skill',
      resource_id: null,
      resource_count: needsImprovement.length,
      action_label: '去进化',
      action_target: '/skills',
      can_create_proposal: false,
      rule_id: 'skill.needs_improvement',
    });
  }

  // Rule 5: duplicates
  if (dupResult) {
    const dupIds = Object.keys(dupResult.assignment);
    const activeDups = dupIds.filter((id) => active.some((s) => s.id === id));
    if (activeDups.length > 0) {
      suggestions.push({
        id: 'skill.duplicate',
        title: `有 ${activeDups.length} 个疑似重复 Skills`,
        reason: '同资源库中存在名称或内容高度相似的 Skills，建议检查并合并。',
        severity: 'warning',
        resource_type: 'skill',
        resource_id: null,
        resource_count: activeDups.length,
        action_label: '查看重复',
        action_target: '/skills',
        can_create_proposal: false,
        rule_id: 'skill.duplicate',
      });
    }
  }

  // Rule 6: long unused
  const now = Date.now();
  const longUnused = active.filter((s) => {
    if (s.total_usage_count > 0) return false;
    if (!s.last_used_at) return true;
    return (now - new Date(s.last_used_at).getTime()) > NINETY_DAYS_MS;
  });
  if (longUnused.length > 0) {
    suggestions.push({
      id: 'skill.long_unused',
      title: `有 ${longUnused.length} 个 Skills 长期未使用`,
      reason: '这些 Skills 从未被观测使用或超过 90 天未使用，可能可以归档。',
      severity: 'info',
      resource_type: 'skill',
      resource_id: null,
      resource_count: longUnused.length,
      action_label: '去检查',
      action_target: '/skills',
      can_create_proposal: false,
      rule_id: 'skill.long_unused',
    });
  }

  // Rule 7: high usage but low quality metadata
  const highUsageLowQuality = active.filter(
    (s) => s.total_usage_count >= 10 && (!s.description || !s.category),
  );
  if (highUsageLowQuality.length > 0) {
    suggestions.push({
      id: 'skill.high_usage_low_quality',
      title: `有 ${highUsageLowQuality.length} 个高使用 Skills 但元数据不完整`,
      reason: '这些 Skills 使用频率高但缺少描述或分类，优先补全可大幅提升 AI 可读性。',
      severity: 'critical',
      resource_type: 'skill',
      resource_id: null,
      resource_count: highUsageLowQuality.length,
      action_label: '优先补全',
      action_target: '/skills',
      can_create_proposal: false,
      rule_id: 'skill.high_usage_low_quality',
    });
  }

  return suggestions;
}
