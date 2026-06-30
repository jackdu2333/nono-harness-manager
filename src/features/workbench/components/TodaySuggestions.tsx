import { Lightbulb, ShieldCheck } from 'lucide-react';
import type { GovernanceSuggestion } from '../types';
import { SuggestionCard } from './SuggestionCard';

interface TodaySuggestionsProps {
  suggestions: GovernanceSuggestion[];
  onNavigate: (path: string) => void;
  onCreateProposal?: (suggestion: GovernanceSuggestion) => void;
}

const MAX_DISPLAY = 10;

export function TodaySuggestions({ suggestions, onNavigate, onCreateProposal }: TodaySuggestionsProps) {
  const displayed = suggestions.slice(0, MAX_DISPLAY);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">今日建议</h2>
          {suggestions.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">
              {suggestions.length}
            </span>
          )}
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <ShieldCheck className="w-6 h-6 text-emerald-500/60" />
          <p className="text-sm text-muted-foreground">暂无需要处理的建议</p>
          <p className="text-xs text-muted-foreground/60">所有资源状态良好</p>
        </div>
      ) : (
        <div>
          {displayed.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onNavigate={onNavigate}
              onCreateProposal={onCreateProposal}
            />
          ))}
          {suggestions.length > MAX_DISPLAY && (
            <div className="px-5 py-2 text-xs text-muted-foreground/60 text-center">
              还有 {suggestions.length - MAX_DISPLAY} 条建议未显示
            </div>
          )}
        </div>
      )}
    </div>
  );
}
