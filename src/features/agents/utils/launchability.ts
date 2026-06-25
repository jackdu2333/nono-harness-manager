import { Agent } from '../types';

export function isAgentLaunchable(agent: Agent): boolean {
  if (agent.type === 'CLI' || agent.type === 'IDE Plugin') {
    return false;
  }

  return Boolean(agent.app_path?.endsWith('.app') || isSafeOpenCommand(agent.launch_command));
}

export function getAgentLaunchUnavailableReason(agent: Agent): string {
  if (agent.type === 'CLI') {
    return 'CLI Agent 第一阶段不直接启动，请先配置安全启动方式。';
  }

  if (agent.type === 'IDE Plugin') {
    return 'IDE 插件不能单独启动，请从宿主应用中打开。';
  }

  return '缺少可安全启动的 macOS App 路径。';
}

function isSafeOpenCommand(command: string | null): boolean {
  if (!command) return false;
  const appName = command.trim().replace(/^open -a\s+/, '').trim();
  return command.trim().startsWith('open -a ')
    && appName.length > 0
    && !/[;&|`$><]/.test(appName);
}
