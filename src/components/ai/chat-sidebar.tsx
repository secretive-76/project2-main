import { Plus, MessageSquare, Trash2, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import type { ChatConversation } from '@/hooks/use-chat';

interface ChatSidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

function groupByDate(conversations: ChatConversation[]) {
  const groups: { label: string; items: ChatConversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous', items: [] },
  ];
  for (const conv of conversations) {
    const d = new Date(conv.updated_at);
    if (isToday(d)) groups[0].items.push(conv);
    else if (isYesterday(d)) groups[1].items.push(conv);
    else groups[2].items.push(conv);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: ChatSidebarProps) {
  const groups = groupByDate(conversations);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3">
        <Button onClick={onNew} className="flex-1 justify-start" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New chat
        </Button>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Conversation list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/60">Start a new chat to begin</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((conv) => (
                  <li key={conv.id}>
                    <div
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer',
                        activeId === conv.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                      onClick={() => onSelect(conv.id)}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <span className="line-clamp-1 flex-1">{conv.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(conv.id);
                        }}
                        className="shrink-0 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal/20 to-indigo/20">
            <Sparkles className="h-4 w-4 text-teal" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">Akademia AI Coach</p>
            <p className="truncate text-[11px] text-muted-foreground">Personalized learning</p>
          </div>
          <Badge className="shrink-0 bg-indigo/10 text-indigo hover:bg-indigo/10">PRO</Badge>
        </div>
      </div>
    </div>
  );
}
