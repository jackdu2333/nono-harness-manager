import React, { useState } from 'react';
import { McpServer } from '@/features/mcp/types';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MASK_KEYWORDS = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'AUTH', 'CREDENTIAL'];

function maskEnvValue(key: string, value: string, isRevealed: boolean) {
  if (isRevealed) return value;
  if (MASK_KEYWORDS.some(keyword => key.toUpperCase().includes(keyword))) {
    return '••••••••••••••••';
  }
  return value;
}

export function MCPConfigTab({ server }: { server: McpServer }) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const [revealedEnvs, setRevealedEnvs] = useState<Record<string, boolean>>({});

  const toggleEnvReveal = (key: string) => {
    setRevealedEnvs(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
            {Object.entries(envJson).map(([key, value], idx, arr) => {
              const isSensitive = MASK_KEYWORDS.some(kw => key.toUpperCase().includes(kw));
              const isRevealed = !!revealedEnvs[key];
              const displayValue = maskEnvValue(key, String(value), isRevealed);

              return (
                <div key={key} className={`flex items-center px-4 py-2 hover:bg-secondary/40 transition-colors ${idx !== arr.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className="w-1/3 font-medium text-muted-foreground truncate" title={key}>{key}</div>
                  <div className="flex-1 font-mono text-foreground truncate">{displayValue}</div>
                  {isSensitive && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 text-muted-foreground" onClick={() => toggleEnvReveal(key)}>
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground bg-secondary/20 rounded-lg border border-border/50 text-center">
            No environment variables configured
          </div>
        )}
      </section>

      <section>
        <Button variant="ghost" className="w-full justify-between" onClick={() => setShowRaw(!showRaw)}>
          <span className="font-semibold">Raw Configuration</span>
          {showRaw ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
        {showRaw && (
          <div className="mt-2 p-4 bg-muted/50 rounded-lg border border-border/50 overflow-x-auto">
            <pre className="text-xs font-mono text-foreground">
              {JSON.stringify(server, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
