import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  sendChatMessage,
  type ChatMessage,
  type ChatResponse,
} from '@/features/ai/api';

interface ChatBoxProps {
  onNavigate?: (path: string) => void;
}

const PLACEHOLDER_MESSAGES = [
  '哪些 Skill 最值得整理？',
  '哪些 Agent 识别有问题？',
  '帮我生成今天的治理计划。',
];

export function ChatBox({ onNavigate }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;

    setInput('');
    setError(null);
    setEvidence([]);
    setSuggestedActions([]);
    setIsSending(true);

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      session_id: sessionId ?? '',
      role: 'user',
      content,
      tool_calls_json: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response: ChatResponse = await sendChatMessage(content, sessionId ?? undefined);
      setSessionId(response.message.session_id);
      setMessages((prev) => [...prev, response.message]);
      setEvidence(response.evidence);
      setSuggestedActions(response.suggested_actions);
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3 bg-muted/30">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">问问 Harness</h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
          AI
        </span>
      </div>

      {/* Messages area */}
      <div className="max-h-80 overflow-y-auto px-5 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">试试问 Harness：</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PLACEHOLDER_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => handlePlaceholderClick(msg)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary/10 text-foreground'
                      : 'bg-muted/50 text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">思考中...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Evidence & Suggested Actions */}
      {(evidence.length > 0 || suggestedActions.length > 0) && messages.length > 0 && (
        <div className="border-t border-border px-5 py-2 bg-muted/20">
          {evidence.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {evidence.map((e, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {e}
                </span>
              ))}
            </div>
          )}
          {suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestedActions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (a.includes('Skills')) onNavigate?.('/skills');
                    else if (a.includes('Proposals')) onNavigate?.('/proposals');
                    else if (a.includes('Agents')) onNavigate?.('/agents');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-border text-primary hover:bg-primary/10 transition-colors"
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t border-border px-5 py-2 bg-red-500/5">
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问问 Harness..."
          disabled={isSending}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="h-7 w-7 p-0"
        >
          {isSending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
