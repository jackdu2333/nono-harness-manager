import React from 'react';
import { McpServer } from '../types';
import { TerminalSquare, MoreHorizontal, Trash2 } from 'lucide-react';
import { useMcpStore } from '../store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  server: McpServer;
  isSelected: boolean;
  onSelect: (server: McpServer) => void;
}

export function MCPServerListItem({ server, isSelected, onSelect }: Props) {
  // Determine status color
  const statusLower = (server.status || '').toLowerCase();
  let statusColor = 'bg-gray-400';
  if (statusLower === 'active') statusColor = 'bg-green-500';
  else if (statusLower === 'error' || statusLower === 'broken') statusColor = 'bg-red-500';
  else if (statusLower === 'warning') statusColor = 'bg-yellow-500';

  const sourceName = server.source_path?.includes('Library/Application Support') ? 'System Config' 
    : server.source_path?.includes('.gemini') ? 'Project Config' 
    : 'Manual';

  return (
    <div
      onClick={() => onSelect(server)}
      className={`
        relative group flex items-start p-4 cursor-pointer transition-all border-b border-border/50
        min-h-[96px] max-h-[116px]
        ${isSelected 
          ? 'bg-secondary/30 border-l-2 border-l-primary' 
          : 'bg-transparent hover:bg-secondary/10 border-l-2 border-l-transparent'
        }
      `}
    >
      <div className="flex items-start gap-3 w-full">
        {/* Status Dot */}
        <div className="pt-1.5 shrink-0">
          <span className={`block w-2.5 h-2.5 rounded-full ${statusColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Top Row: Name and Transport */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
              {server.name}
            </h3>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 pr-4 leading-relaxed">
            {server.description || '暂无描述'}
          </p>

          {/* Meta Chips */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-[11px] text-muted-foreground/80">
            <span className="font-medium bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground shrink-0">{sourceName}</span>
            <span className="shrink-0">•</span>
            <span className="shrink-0">stdio</span>
            <span className="shrink-0">•</span>
            <span className="flex items-center gap-1 shrink-0 font-mono">
              <TerminalSquare className="w-3 h-3" />
              {server.command.split('/').pop()}
            </span>
            <span className="shrink-0">•</span>
            <span className="shrink-0">Tools 0</span>
            <span className="shrink-0">•</span>
            <span className="shrink-0">Resources 0</span>
            <span className="shrink-0 ml-auto hidden sm:block">
              {new Date(server.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Hover Actions */}
        <div className={`shrink-0 flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="w-7 h-7 rounded-full" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem 
                onSelect={(e) => { 
                  e.preventDefault();
                  useMcpStore.getState().deleteServer(server.id);
                }} 
                className="text-red-600 focus:text-red-600 dark:text-red-500 focus:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" /> 移除服务器
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
