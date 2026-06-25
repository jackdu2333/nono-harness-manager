import { MousePointer2, MessageSquareText, Waves, Code2, Briefcase, Sparkles, Terminal, Bot } from 'lucide-react';

export function getAgentBrandStyles(name: string, type?: string | null) {
  const n = name.toLowerCase();
  
  if (n.includes('codex')) return { imgSrc: '/icons/codex.png', textClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10' };
  if (n.includes('workbuddy')) return { imgSrc: '/icons/workbuddy.png', textClass: 'text-pink-500', bgClass: 'bg-pink-500/10' };

  if (n.includes('cursor')) return { Icon: MousePointer2, textClass: 'text-blue-500', bgClass: 'bg-blue-500/10' };
  if (n.includes('claude')) return { Icon: MessageSquareText, textClass: 'text-orange-500', bgClass: 'bg-orange-500/10' };
  if (n.includes('windsurf')) return { Icon: Waves, textClass: 'text-teal-500', bgClass: 'bg-teal-500/10' };
  if (n.includes('nono') || n.includes('antigravity')) return { Icon: Sparkles, textClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10' };
  if (n.includes('cli') || type === 'CLI') return { Icon: Terminal, textClass: 'text-gray-500 dark:text-gray-400', bgClass: 'bg-gray-500/10' };
  
  return { Icon: Bot, textClass: 'text-indigo-400', bgClass: 'bg-muted' };
}
