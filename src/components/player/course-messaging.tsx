import { useState, useEffect } from 'react';
import { Send, MessageSquare, Loader as Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCourseMessages } from '@/hooks/use-course-messages';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

export function CourseMessaging({ courseId, instructorName = 'Course instructor' }: { courseId: string; instructorName?: string }) {
  const { user } = useAuth();
  const { messages, loading, sending, error, sendMessage, scrollRef } = useCourseMessages(courseId);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, scrollRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{instructorName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{instructorName}</p>
          <p className="truncate text-xs text-muted-foreground">Course support</p>
        </div>
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask your instructor a question about this course.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isStudent = msg.sender_role === 'student';
            return (
              <div
                key={msg.id}
                className={cn('flex', isStudent ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    isStudent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      isStudent ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    )}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message your instructor…"
          disabled={sending || !user}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
      {error && <p className="px-3 pb-3 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
