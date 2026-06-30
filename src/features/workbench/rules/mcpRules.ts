import type { McpServer } from '@/features/mcp/types';
import type { GovernanceSuggestion } from '../types';

export function analyzeMcpRules(mcpServers: McpServer[]): GovernanceSuggestion[] {
  const suggestions: GovernanceSuggestion[] = [];

  // Rule 1: missing description and summary
  const missingDesc = mcpServers.filter((m) => !m.description && !m.summary);
  if (missingDesc.length > 0) {
    suggestions.push({
      id: 'mcp.missing_description',
      title: `有 ${missingDesc.length} 个 MCP Server 缺少描述`,
      reason: '缺少描述和摘要的 MCP Server 难以让 AI 客户端理解其用途。',
      severity: 'warning',
      resource_type: 'mcp_server',
      resource_id: null,
      resource_count: missingDesc.length,
      action_label: '去补全',
      action_target: '/mcp',
      can_create_proposal: false,
      rule_id: 'mcp.missing_description',
    });
  }

  // Rule 2: missing category and tags
  const missingCat = mcpServers.filter((m) => !m.category && !m.tags);
  if (missingCat.length > 0) {
    suggestions.push({
      id: 'mcp.missing_category',
      title: `有 ${missingCat.length} 个 MCP Server 缺少分类/标签`,
      reason: '缺少分类和标签的 MCP Server 在筛选时难以被发现。',
      severity: 'info',
      resource_type: 'mcp_server',
      resource_id: null,
      resource_count: missingCat.length,
      action_label: '去设置',
      action_target: '/mcp',
      can_create_proposal: false,
      rule_id: 'mcp.missing_category',
    });
  }

  // Rule 3: empty command
  const emptyCommand = mcpServers.filter(
    (m) => !m.command || m.command.trim() === '',
  );
  if (emptyCommand.length > 0) {
    suggestions.push({
      id: 'mcp.command_empty',
      title: `有 ${emptyCommand.length} 个 MCP Server 命令为空`,
      reason: '启动命令为空的 MCP Server 无法正常运行，请检查配置。',
      severity: 'critical',
      resource_type: 'mcp_server',
      resource_id: null,
      resource_count: emptyCommand.length,
      action_label: '去修复',
      action_target: '/mcp',
      can_create_proposal: false,
      rule_id: 'mcp.command_empty',
    });
  }

  // Rule 4: missing source_path
  const missingSource = mcpServers.filter((m) => !m.source_path);
  if (missingSource.length > 0) {
    suggestions.push({
      id: 'mcp.source_path_missing',
      title: `有 ${missingSource.length} 个 MCP Server 缺少来源路径`,
      reason: '缺少来源路径的 MCP Server 无法追溯配置文件位置。',
      severity: 'info',
      resource_type: 'mcp_server',
      resource_id: null,
      resource_count: missingSource.length,
      action_label: '去查看',
      action_target: '/mcp',
      can_create_proposal: false,
      rule_id: 'mcp.source_path_missing',
    });
  }

  // Rule 5: abnormal health status
  const abnormal = mcpServers.filter(
    (m) => m.status === 'broken' || m.status === 'error',
  );
  if (abnormal.length > 0) {
    suggestions.push({
      id: 'mcp.status_abnormal',
      title: `有 ${abnormal.length} 个 MCP Server 健康状态异常`,
      reason: '状态为 broken 或 error 的 MCP Server 可能存在配置损坏或依赖缺失。',
      severity: 'critical',
      resource_type: 'mcp_server',
      resource_id: null,
      resource_count: abnormal.length,
      action_label: '去修复',
      action_target: '/mcp',
      can_create_proposal: false,
      rule_id: 'mcp.status_abnormal',
    });
  }

  return suggestions;
}
