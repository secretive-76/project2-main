import { NavLink } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { navGroups, adminNavGroups } from '@/lib/mock-data';
import { getIcon } from '@/lib/format';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

// Custom navigation groups specifically for the Instructor portal
const customInstructorNavGroups = [
  {
    label: 'Manage',
    items: [
      { label: 'Dashboard', to: '/instructor/dashboard', icon: 'LayoutDashboard' },
      { label: 'My Courses', to: '/instructor/courses', icon: 'BookOpen' },
      { label: 'Grading', to: '/instructor/grading', icon: 'GraduationCap' },
      { label: 'Students', to: '/instructor/students', icon: 'Users' },
      { label: 'Discussions', to: '/instructor/discussions', icon: 'MessageSquare' },
      { label: 'Course Feedback', to: '/instructor/feedback', icon: 'MessageSquare' },
      { label: 'AI Content Tools', to: '/instructor/ai-tools', icon: 'Sparkles', badge: 'AI' },
    ],
  },
  {
    label: 'You',
    items: [
      { label: 'Settings', to: '/instructor/settings', icon: 'Settings' },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'student';

  const groups =
    role === 'instructor'
      ? customInstructorNavGroups
      : role === 'admin'
        ? adminNavGroups
        : navGroups;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo size="sm" />
        {onNavigate && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onNavigate}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = getIcon(item.icon);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        )
                      }
                    >
                      <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 transition-transform group-hover:scale-110" />
                      <span className="flex-1">{item.label}</span>
                      {'badge' in item && item.badge && (
                        <Badge
                          variant="secondary"
                          className="h-5 shrink-0 gap-1 bg-indigo/10 px-1.5 text-[10px] font-semibold text-indigo"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {item.badge}
                        </Badge>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo/15 to-teal/15">
            <Sparkles className="h-4 w-4 text-indigo" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">Akademia Pro</p>
            <p className="truncate text-[11px] text-muted-foreground">Unlimited AI coaching</p>
          </div>
        </div>
      </div>
    </div>
  );
}
