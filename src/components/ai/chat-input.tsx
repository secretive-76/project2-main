import { useRef, useEffect, type FormEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isSending?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled, isSending }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-end gap-2 rounded-2xl border border-input bg-muted/30 p-2 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
            <Textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Akademia anything…"
              rows={1}
              className="max-h-[200px] min-h-[24px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm focus-visible:ring-0 focus-visible:outline-none"
              disabled={disabled}
            />
            <Button
              type="submit"
              size="icon"
              className={cn('h-8 w-8 shrink-0 rounded-lg', !value.trim() && 'opacity-50')}
              disabled={!value.trim() || disabled}
              aria-label="Send message"
            >
              {isSending ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
          Akademia AI Coach can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
