import { Loader2, Check, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLessonNotes } from '@/hooks/use-lesson-notes';
import { cn } from '@/lib/utils';

interface NotesPanelProps {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  className?: string;
}

export function NotesPanel({ courseId, lessonId, lessonTitle, className }: NotesPanelProps) {
  const { content, loading, saving, saved, updateContent } = useLessonNotes(courseId, lessonId);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">My notes</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Saving…</span>
            </>
          ) : saved ? (
            <>
              <Check className="h-3 w-3 text-success" />
              <span className="text-success">Saved</span>
            </>
          ) : (
            <span className="text-muted-foreground">{content.trim() ? 'Auto-save on' : 'Empty'}</span>
          )}
        </div>
      </div>

      <div className="border-b border-border px-4 py-2">
        <p className="truncate text-xs text-muted-foreground">{lessonTitle}</p>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Textarea
          value={content}
          onChange={(e) => updateContent(e.target.value)}
          placeholder="Take notes on this lesson. They save automatically and follow you wherever you go in the course."
          className="h-full min-h-[200px] flex-1 resize-none border-0 bg-muted/30 focus-visible:ring-1"
        />
        {content.trim() && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.trim().length} characters</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => updateContent('')}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
