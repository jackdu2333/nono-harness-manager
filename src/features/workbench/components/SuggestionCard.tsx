import { AlertTriangle, AlertCircle, Info, ArrowRight, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GovernanceSuggestion } from '../types';

interface SuggestionCardProps {
  suggestion: GovernanceSuggestion;
  onNavigate: (path: string) => void;
  onCreateProposal?: (suggestion: GovernanceSuggestion) => void;
}

const severityConfig = {
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    icon: AlertCircle,
  },
  warning: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    icon: AlertTriangle,
  },
  info: {
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-l-sky-500',
    icon: Info,
  },
};

export function SuggestionCard({ suggestion, onNavigate, onCreateProposal }: SuggestionCardProps) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 border-l-2 ${config.border}`}
    >
      <div className={`flex-shrink-0 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
        <div className="text-xs text-muted-foreground truncate">{suggestion.reason}</div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 h-7 text-xs gap-1"
        onClick={() => onNavigate(suggestion.action_target)}
      >
        {suggestion.action_label}
        <ArrowRight className="w-3 h-3" />
      </Button>

      {suggestion.can_create_proposal && onCreateProposal && (
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/10"
          onClick={() => onCreateProposal(suggestion)}
        >
          <FilePlus className="w-3 h-3" />
          创建 Proposal
        </Button>
      )}
    </div>
  );
}
