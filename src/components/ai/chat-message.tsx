import { Sparkles, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MarkdownRenderer } from '@/components/ai/markdown-renderer';
import { useAuth } from '@/components/providers/auth-provider';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/use-chat';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function ChatMessageBubble({
  message,
  isStreaming,
  streamingContent,
}: ChatMessageBubbleProps) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const displayName = user?.name ?? 'You';
  const avatarUrl = user?.avatarUrl ?? '';

  const content = isStreaming ? (streamingContent ?? '') : message.content;

  if (isUser) {
    return (
      <div className="flex gap-3 px-4 py-5 sm:px-6">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-muted text-xs font-semibold">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold text-foreground">{displayName}</p>
          <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-5 sm:px-6">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal/20 to-indigo/20">
        <Sparkles className="h-4 w-4 text-teal" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          Akademia Coach
          {isStreaming && (
            <span className="inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
          )}
        </p>
        <div className={cn('rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3')}>
          {isStreaming && !content ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
            </div>
          ) : (
            <MarkdownRenderer content={content} />
          )}
          {isStreaming && content && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
