import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Search,
  Sparkles,
  Compass,
  BookOpen,
  TrendingUp,
  Trophy,
  Settings,
  Moon,
  Sun,
  CornerDownLeft,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { courses } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl sm:max-w-xl">
        <CommandPrimitive className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              placeholder="Search courses, pages, or ask Akademia AI…"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <kbd className="hidden shrink-0 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ESC
            </kbd>
          </div>
          <CommandPrimitive.List className="scrollbar-thin max-h-[420px] overflow-y-auto overflow-x-hidden p-2">
            <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
              No results found.
            </CommandPrimitive.Empty>

            <CommandPrimitive.Group
              heading="Ask Akademia AI"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <CommandItem
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                label="Explain a concept I'm stuck on"
                onSelect={() => go('/student/ai-coach')}
              />
              <CommandItem
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                label="Analyze my skill gaps"
                onSelect={() => go('/student/skills')}
              />
            </CommandPrimitive.Group>

            <CommandPrimitive.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <CommandItem
                icon={<Compass className="h-4 w-4 text-muted-foreground" />}
                label="Browse Courses"
                onSelect={() => go('/student/browse')}
              />
              <CommandItem
                icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                label="My Courses"
                onSelect={() => go('/student/my-courses')}
              />
              <CommandItem
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                label="Skills"
                onSelect={() => go('/student/skills')}
              />
              <CommandItem
                icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
                label="Achievements"
                onSelect={() => go('/student/achievements')}
              />
              <CommandItem
                icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                label="Settings"
                onSelect={() => go('/student/settings')}
              />
            </CommandPrimitive.Group>

            <CommandPrimitive.Group
              heading="Courses"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {courses.map((c) => (
                <CommandItem
                  key={c.id}
                  icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                  label={c.title}
                  hint={c.category}
                  onSelect={() => go(`/student/courses/${c.slug}`)}
                />
              ))}
            </CommandPrimitive.Group>

            <CommandPrimitive.Group
              heading="Theme"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <CommandItem
                icon={theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                label={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                onSelect={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  onOpenChange(false);
                }}
              />
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Akademia AI</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>to select</span>
              <kbd className="flex h-5 w-5 items-center justify-center rounded border border-border bg-muted">
                <CornerDownLeft className="h-3 w-3" />
              </kbd>
            </div>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <CommandPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm outline-none',
        'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
        'transition-colors'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate text-foreground">{label}</span>
      {hint && (
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {hint}
        </span>
      )}
    </CommandPrimitive.Item>
  );
}
