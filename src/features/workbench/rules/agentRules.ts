import type { Agent } from '@/features/agents/types';
import type { GovernanceSuggestion } from '../types';

export function analyzeAgentRules(agents: Agent[]): GovernanceSuggestion[] {
  const suggestions: GovernanceSuggestion[] = [];

  // Rule 1: candidate agents awaiting confirmation
  const candidates = agents.filter(
    (a) =>
      (a.confidence === 'candidate' || a.status === 'pending') &&
      !a.is_ignored,
  );
  if (candidates.length > 0) {
    suggestions.push({
      id: 'agent.candidate',
      title: `有 ${candidates.length} 个 Agent 待确认`,
      reason: '这些 Agent 被检测到但尚未确认，确认后才能在分析和统计中使用。',
      severity: 'warning',
      resource_type: 'agent',
      resource_id: null,
      resource_count: candidates.length,
      action_label: '去确认',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.candidate',
    });
  }

  // Rule 2: probable but unconfirmed
  const unconfirmedProbable = agents.filter(
    (a) =>
      a.confidence === 'probable' &&
      !a.is_user_confirmed &&
      !a.is_ignored,
  );
  if (unconfirmedProbable.length > 0) {
    suggestions.push({
      id: 'agent.unconfirmed_probable',
      title: `有 ${unconfirmedProbable.length} 个 Agent 可能有效但未确认`,
      reason: '置信度为 probable 的 Agent 很可能是真实存在的，建议尽快确认。',
      severity: 'warning',
      resource_type: 'agent',
      resource_id: null,
      resource_count: unconfirmedProbable.length,
      action_label: '去确认',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.unconfirmed_probable',
    });
  }

  // Rule 3: ignored agents available for review
  const ignored = agents.filter((a) => a.is_ignored === true);
  if (ignored.length > 0) {
    suggestions.push({
      id: 'agent.ignored_review',
      title: `有 ${ignored.length} 个被忽略的 Agent 可复查`,
      reason: '被忽略的 Agent 可能是误识别，也可能已恢复有效。',
      severity: 'info',
      resource_type: 'agent',
      resource_id: null,
      resource_count: ignored.length,
      action_label: '去复查',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.ignored_review',
    });
  }

  // Rule 4: missing paths
  const pathMissing = agents.filter(
    (a) => !a.app_path && !a.cli_path && !a.config_path,
  );
  if (pathMissing.length > 0) {
    suggestions.push({
      id: 'agent.path_missing',
      title: `有 ${pathMissing.length} 个 Agent 路径信息缺失`,
      reason: '缺少 app_path、cli_path 和 config_path，无法进行启动或配置分析。',
      severity: 'warning',
      resource_type: 'agent',
      resource_id: null,
      resource_count: pathMissing.length,
      action_label: '去查看',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.path_missing',
    });
  }

  // Rule 5: broken status
  const broken = agents.filter((a) => a.status === 'broken');
  if (broken.length > 0) {
    suggestions.push({
      id: 'agent.broken',
      title: `有 ${broken.length} 个 Agent 状态为 broken`,
      reason: '状态为 broken 的 Agent 可能存在路径失效或配置损坏，建议检查。',
      severity: 'critical',
      resource_type: 'agent',
      resource_id: null,
      resource_count: broken.length,
      action_label: '去修复',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.broken',
    });
  }

  // Rule 6: App type but not launchable
  const appNotLaunchable = agents.filter(
    (a) =>
      a.type === 'App' &&
      (!a.app_path || !a.app_path.endsWith('.app')),
  );
  if (appNotLaunchable.length > 0) {
    suggestions.push({
      id: 'agent.app_not_launchable',
      title: `有 ${appNotLaunchable.length} 个 App 类型 Agent 不可启动`,
      reason: '标记为 App 类型但 app_path 不是有效的 .app 路径，无法从 Harness 启动。',
      severity: 'warning',
      resource_type: 'agent',
      resource_id: null,
      resource_count: appNotLaunchable.length,
      action_label: '去检查',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.app_not_launchable',
    });
  }

  // Rule 7: detection_source present but log_path missing
  const logPathMissing = agents.filter(
    (a) =>
      a.detection_source &&
      a.detection_source.length > 0 &&
      !a.log_path,
  );
  if (logPathMissing.length > 0) {
    suggestions.push({
      id: 'agent.log_path_missing',
      title: `有 ${logPathMissing.length} 个 Agent 支持日志统计但 log_path 缺失`,
      reason: '这些 Agent 被发现但缺少日志路径，无法进行使用量分析。',
      severity: 'info',
      resource_type: 'agent',
      resource_id: null,
      resource_count: logPathMissing.length,
      action_label: '去查看',
      action_target: '/agents',
      can_create_proposal: false,
      rule_id: 'agent.log_path_missing',
    });
  }

  return suggestions;
}
