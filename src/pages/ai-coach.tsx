import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Brain,
  Bug,
  MessageSquare,
  Code,
  PanelLeftOpen,
  Menu,
  ArrowLeft,
} from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { ChatSidebar } from '@/components/ai/chat-sidebar';
import { ChatMessageBubble } from '@/components/ai/chat-message';
import { ChatInput } from '@/components/ai/chat-input';
import { useChat } from '@/hooks/use-chat';
import { suggestedPrompts } from '@/lib/ai-engine';
import { cn } from '@/lib/utils';

const promptIcons: Record<string, typeof Brain> = {
  brain: Brain,
  bug: Bug,
  message: MessageSquare,
  code: Code,
};

export function AICoachPage() {
  const {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    streamingText,
    error,
    setActiveConversationId,
    sendMessage,
    newConversation,
    deleteConversation,
  } = useChat();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;
  const isStreaming = sending && streamingText !== undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
 el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
  }, [messages, streamingText]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border lg:block">
        <ChatSidebar
          conversations={conversations}
          activeId={activeConversationId}
          loading={loadingConversations}
          onSelect={setActiveConversationId}
          onNew={newConversation}
          onDelete={deleteConversation}
        />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-sidebar-border shadow-xl">
            <ChatSidebar
              conversations={conversations}
              activeId={activeConversationId}
              loading={loadingConversations}
              onSelect={(id) => {
                setActiveConversationId(id);
                setSidebarOpen(false);
              }}
              onNew={() => {
                newConversation();
                setSidebarOpen(false);
              }}
              onDelete={deleteConversation}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversations"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/student/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="mx-auto flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-teal/20 to-indigo/20">
              <Sparkles className="h-3.5 w-3.5 text-teal" />
            </div>
            <span className="text-sm font-semibold text-foreground">AI Coach</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Messages or welcome */}
        <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Loading conversation…</p>
              </div>
            </div>
          ) : !hasMessages && !sending ? (
            <WelcomeScreen onPromptClick={handlePromptClick} />
          ) : (
            <div className="mx-auto max-w-3xl divide-y divide-border/50 pb-6">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <ChatMessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: '',
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                  streamingContent={streamingText}
                />
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={sending}
          isSending={sending}
        />
        {error && <p className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-center text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function WelcomeScreen({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal/20 to-indigo/20">
        <Sparkles className="h-8 w-8 text-teal" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        How can I help you learn today?
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-muted-foreground sm:text-base">
        I'm your personal AI coach. Ask me to explain concepts, debug code, practice interviews,
        or build a learning plan.
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {suggestedPrompts.map((prompt) => {
          const Icon = promptIcons[prompt.icon] ?? Brain;
          return (
            <button
              key={prompt.title}
              onClick={() => onPromptClick(prompt.prompt)}
              className={cn(
                'group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all',
                'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-foreground/5'
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal transition-transform group-hover:scale-110">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{prompt.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{prompt.prompt}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
