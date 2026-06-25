import { McpServer } from '@/features/mcp/types';

export function MCPConfigTab({ server }: { server: McpServer }) {
  const parseJsonStr = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const argsJson = parseJsonStr(server.args);
  const envJson = parseJsonStr(server.env);

  return (
    <div className="space-y-6">
      <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden text-sm">
        <div className="flex border-b border-border/50">
          <div className="w-28 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">Command</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground">{server.command}</div>
        </div>
        <div className="flex border-b border-border/50">
          <div className="w-28 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">Args</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground whitespace-pre-wrap break-all">
            {argsJson ? JSON.stringify(argsJson, null, 2) : <span className="text-muted-foreground italic">None</span>}
          </div>
        </div>
        <div className="flex">
          <div className="w-28 px-4 py-3 bg-secondary/50 font-medium text-muted-foreground border-r border-border/50">Config Path</div>
          <div className="px-4 py-3 font-mono flex-1 text-foreground break-all">
            {server.source_path || <span className="text-muted-foreground italic">Unknown</span>}
          </div>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Environment Variables</h3>
        {envJson && typeof envJson === 'object' && Object.keys(envJson).length > 0 ? (
          <div className="bg-secondary/20 rounded-lg border border-border/50 overflow-hidden text-sm">
            <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border/50">
              敏感值已在扫描阶段脱敏存储，无法在 Harness Manager 中显示原值。
            </div>
            {Object.entries(envJson).map(([key, value], idx, arr) => (
              <div key={key} className={`flex items-center px-4 py-2 hover:bg-secondary/40 transition-colors ${idx !== arr.length - 1 ? 'border-b border-border/50' : ''}`}>
                <div className="w-1/3 font-medium text-muted-foreground truncate" title={key}>{key}</div>
                <div className="flex-1 font-mono text-foreground truncate">{String(value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground bg-secondary/20 rounded-lg border border-border/50 text-center">
            No environment variables configured
          </div>
        )}
      </section>

      <section className="p-4 text-xs text-muted-foreground bg-secondary/20 rounded-lg border border-border/50">
        原始 MCP 配置文件不会复制进界面展示；这里只显示 Harness 已索引的安全字段。
      </section>
    </div>
  );
}
