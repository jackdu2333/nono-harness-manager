import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Send, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  sendChatMessage,
  listChatSessions,
  getChatMessages,
  type ChatMessage,
  type ChatResponse,
  type ToolCallSummary,
} from '@/features/ai/api';

interface ChatMessageWithSummary extends ChatMessage {
  tool_calls_summary?: ToolCallSummary[] | null;
  evidence?: string[] | null;
  suggested_actions?: string[] | null;
}

interface ChatBoxProps {
  onNavigate?: (path: string) => void;
}

const PLACEHOLDER_MESSAGES = [
  '哪些 Skill 最值得整理？',
  '哪些 Agent 识别有问题？',
  '帮我生成今天的治理计划。',
];

export function ChatBox({ onNavigate }: ChatBoxProps) {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessageWithSummary[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Load latest chat session on mount
  useEffect(() => {
    let active = true;
    async function loadLatestSession() {
      try {
        const sessions = await listChatSessions();
        if (!active) return;
        if (sessions && sessions.length > 0) {
          const latestSession = sessions[0];
          setSessionId(latestSession.id);
          
          const rawMsgs = await getChatMessages(latestSession.id);
          if (!active) return;
          
          const parsedMsgs: ChatMessageWithSummary[] = rawMsgs.map((msg) => {
            let summaryList: ToolCallSummary[] | null = null;
            let inferredEvidence: string[] = [];
            let inferredActions: string[] = [];

            if (msg.tool_calls_json) {
              try {
                const records = JSON.parse(msg.tool_calls_json);
                if (Array.isArray(records)) {
                  summaryList = records.map((rec: any) => ({
                    tool_name: rec.tool_name,
                    success: rec.success,
                    duration_ms: rec.duration_ms,
                    round: rec.round,
                    summary: rec.result_summary || '',
                  }));

                  // Infer evidence and actions
                  const toolNames = records.map((r: any) => r.tool_name);
                  if (toolNames.includes('get_dashboard_summary')) {
                    inferredEvidence.push('已读取 Dashboard 状态数据');
                  }
                  if (
                    toolNames.includes('get_skill_analysis') ||
                    toolNames.includes('list_resources') ||
                    toolNames.includes('get_resource_context')
                  ) {
                    inferredEvidence.push('已读取本机 Skills 列表');
                    inferredActions.push('查看 Skills');
                  }
                  if (toolNames.includes('get_agent_analysis')) {
                    inferredEvidence.push('已读取本机 Agents 列表');
                    inferredActions.push('进入 Agents');
                  }
                  if (toolNames.includes('get_mcp_analysis')) {
                    inferredEvidence.push('已读取 MCP 配置状态');
                  }
                  if (
                    toolNames.includes('list_pending_proposals') ||
                    toolNames.includes('create_governance_proposal')
                  ) {
                    inferredEvidence.push('已分析治理建议提案');
                    inferredActions.push('查看 Proposals');
                  }
                }
              } catch (e) {
                console.error('Failed to parse tool_calls_json', e);
              }
            }

            if (inferredActions.length === 0) {
              inferredActions = ['查看 Proposals', '进入 Skills'];
            }

            return {
              ...msg,
              tool_calls_summary: summaryList,
              evidence: inferredEvidence.length > 0 ? inferredEvidence : ['读取了 Harness 核心指标'],
              suggested_actions: inferredActions,
            };
          });
          setMessages(parsedMsgs);
        }
      } catch (e) {
        console.error('Failed to load latest session:', e);
      }
    }
    loadLatestSession();
    return () => {
      active = false;
    };
  }, []);

  // Expose loadMessage API by listening to a custom event
  useEffect(() => {
    const handleTriggerMessage = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.prompt) {
        setInput(customEvent.detail.prompt);
        // Focus and trigger send
        setTimeout(() => {
          handleSend(customEvent.detail.prompt);
        }, 10);
      }
    };
    window.addEventListener('trigger-ai-chat-prompt', handleTriggerMessage);
    return () => {
      window.removeEventListener('trigger-ai-chat-prompt', handleTriggerMessage);
    };
  }, [sessionId, isSending]);

  const handleSend = async (forcedPrompt?: string) => {
    const content = forcedPrompt !== undefined ? forcedPrompt.trim() : input.trim();
    if (!content || isSending) return;

    if (forcedPrompt === undefined) {
      setInput('');
    }
    setError(null);
    setIsSending(true);

    // Add user message to UI immediately
    const userMsg: ChatMessageWithSummary = {
      id: `user-${Date.now()}`,
      session_id: sessionId ?? '',
      role: 'user',
      content,
      tool_calls_json: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response: ChatResponse = await sendChatMessage(
        content,
        sessionId ?? undefined,
        location.pathname,
      );
      setSessionId(response.message.session_id);
      
      const assistantMsg: ChatMessageWithSummary = {
        ...response.message,
        tool_calls_summary: response.tool_calls_summary,
        evidence: response.evidence,
        suggested_actions: response.suggested_actions,
      };
      
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePlaceholderClick = (msg: string) => {
    setInput(msg);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full border border-border bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4.5 h-4.5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              问问 Harness
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-bold uppercase">
                AI
              </span>
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              可分析 Skills、Agents、MCP、Proposals，并创建治理建议
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 bg-background/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Sparkles className="w-8 h-8 text-primary/40 mb-3 animate-pulse-slow" />
            <p className="text-sm font-medium text-foreground mb-1">开始与 Harness 助手对话</p>
            <p className="text-xs text-muted-foreground/60 mb-6">试试点击下方问题开始提问：</p>
            <div className="flex flex-col gap-2 max-w-sm w-full px-4">
              {PLACEHOLDER_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => handlePlaceholderClick(msg)}
                  className="text-xs px-4 py-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-all text-left font-medium"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-w-4xl mx-auto w-full">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}
                >
                  {isUser ? (
                    <div className="bg-primary text-primary-foreground text-sm rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm max-w-[85%] font-medium">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[760px] w-full space-y-3">
                      {/* Tool Calls Summary Block */}
                      {msg.tool_calls_summary && msg.tool_calls_summary.length > 0 && (
                        <div className="p-3 bg-muted/40 dark:bg-muted/40 rounded-lg border border-border/80 text-[11px] font-mono text-muted-foreground max-w-xl">
                          <div className="flex items-center gap-1.5 mb-2 font-semibold text-foreground">
                            <span>🔧</span>
                            <span>调用了 {msg.tool_calls_summary.length} 个工具</span>
                          </div>
                          <div className="space-y-1 pl-2 border-l border-border ml-1">
                            {msg.tool_calls_summary.map((summary, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-4">
                                <span className="truncate">
                                  {idx === msg.tool_calls_summary!.length - 1 ? '└─' : '├─'}{' '}
                                  {summary.tool_name}
                                </span>
                                <span className="shrink-0 flex items-center gap-1">
                                  {summary.success ? (
                                    <span className="text-success font-bold">✓</span>
                                  ) : (
                                    <span className="text-destructive font-bold">✗</span>
                                  )}
                                  <span>{summary.duration_ms}ms</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Main Answer Bubble */}
                      <div className="bg-card border border-border rounded-xl px-4 py-3.5 text-sm text-foreground shadow-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Evidence & Suggested Actions Panel */}
                      {((msg.evidence && msg.evidence.length > 0) || (msg.suggested_actions && msg.suggested_actions.length > 0)) && (
                        <div className="flex flex-col gap-2 pl-1">
                          {/* Evidence */}
                          {msg.evidence && msg.evidence.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider shrink-0 mr-1">
                                证据链:
                              </span>
                              {msg.evidence.map((e, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/40 text-muted-foreground/80 font-medium">
                                  {e}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Suggested Actions */}
                          {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider shrink-0 mr-1">
                                建议动作:
                              </span>
                              {msg.suggested_actions.map((a, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (a.includes('Skills') || a.includes('Skill')) onNavigate?.('/skills');
                                    else if (a.includes('Proposals') || a.includes('Proposal')) onNavigate?.('/proposals');
                                    else if (a.includes('Agents') || a.includes('Agent')) onNavigate?.('/agents');
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded border border-primary/20 text-primary bg-primary/[0.02] hover:bg-primary/10 transition-colors font-medium"
                                >
                                  {a}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2 border border-border">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">思考中...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-border px-5 py-2 bg-destructive/5 shrink-0">
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        </div>
      )}

      {/* Footer / Input */}
      <div className="border-t border-border px-4 py-3 bg-muted/10 shrink-0 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问问 Harness..."
          disabled={isSending}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none px-1"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSend()}
          disabled={isSending || !input.trim()}
          className="h-8 w-8 p-0 hover:bg-muted"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Send className="w-4 h-4 text-primary" />
          )}
        </Button>
      </div>
    </div>
  );
}
