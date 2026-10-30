import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  Sparkles,
  Settings,
  LogOut,
  User,
  CreditCard,
  ChevronDown,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { CommandMenu } from '@/components/common/command-menu';
import { useAuth, roleDashboardPath } from '@/components/providers/auth-provider';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

const roleIcon = {
  student: GraduationCap,
  instructor: Users,
  admin: ShieldCheck,
};

const roleAccent = {
  student: 'text-primary',
  instructor: 'text-teal',
  admin: 'text-warning',
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; body: string; link: string; is_read: boolean }>>([]);

  useEffect(() => {
    const load = () => { void apiRequest('/notifications').then((data) => setNotifications(data.notifications ?? [])).catch(() => undefined); };
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const displayName = user?.name ?? 'Learner';
  const email = user?.email ?? '';
  const avatarUrl = user?.avatarUrl ?? '';
  const role = user?.role ?? 'student';
  const RoleIcon = roleIcon[role];

  const handleSignOut = () => {
    signOut();
    toast.success('Signed out', { description: 'See you soon!' });
    navigate('/login');
  };

  const settingsPath = `${roleDashboardPath[role].replace('/dashboard', '')}/settings`;
  const unreadNotifications = notifications.filter((item) => !item.is_read).length;
  const markNotificationsRead = () => { void apiRequest('/notifications/read', { method: 'POST', body: JSON.stringify({}) }).then(() => setNotifications((items) => items.map((item) => ({ ...item, is_read: true })))).catch(() => undefined); };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <button
          onClick={() => setCommandOpen(true)}
          className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:border-input/80"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search or ask Akademia…</span>
          <kbd className="hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* Role badge (read-only, no switching) */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium">
            <RoleIcon className={cn('h-4 w-4', roleAccent[role])} />
            <span className="hidden capitalize sm:inline">{role}</span>
          </div>

          {role === 'student' && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-muted-foreground hover:text-foreground md:flex"
              onClick={() => navigate('/student/ai-coach')}
            >
              <Sparkles className="h-4 w-4 text-teal" />
              <span>AI Coach</span>
            </Button>
          )}

          <ThemeToggle />

          <DropdownMenu onOpenChange={(open) => { if (open && unreadNotifications) markNotificationsRead(); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground" aria-label="Notifications">
                <Bell className="h-[1.15rem] w-[1.15rem]" />
                {unreadNotifications > 0 && <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? <p className="px-3 py-5 text-center text-sm text-muted-foreground">No notifications yet</p> : notifications.slice(0, 6).map((item) => <DropdownMenuItem key={item.id} className="items-start whitespace-normal py-3" onClick={() => item.link && navigate(item.link)}><Bell className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="block text-sm font-medium">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.body}</span></span></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex items-center gap-3 py-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <div className="px-2 pb-1">
                <Badge className="w-full justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/10">
                  <Sparkles className="h-3 w-3" />
                  PRO PLAN
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(settingsPath)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
