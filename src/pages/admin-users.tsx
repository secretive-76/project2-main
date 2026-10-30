import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCcw,
  Users,
  GraduationCap,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/api';
import { initials, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveUser {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
  joined_at: string;
  courses_enrolled: number;
}

interface PendingUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const roleStyles: Record<string, string> = {
  student: 'bg-blue-500/10 text-blue-600 border-blue-200',
  instructor: 'bg-primary/10 text-primary border-primary/20',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actingOn, setActingOn] = useState<number | null>(null);

  // ── Fetch active (approved) users ─────────────────────────────────────────

  const fetchActiveUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/admin/users') as { users: ActiveUser[] };
      setActiveUsers(data.users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch pending (approval queue) users ──────────────────────────────────

  const fetchPendingUsers = useCallback(async () => {
    setPendingLoading(true);
    try {
      const data = await apiRequest('/admin/users/queue') as { users: PendingUser[] };
      setPendingUsers(data.users ?? []);
    } catch {
      setPendingUsers([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveUsers();
    void fetchPendingUsers();
  }, [fetchActiveUsers, fetchPendingUsers]);

  // ── Approve / Reject ──────────────────────────────────────────────────────

  const handleApprove = async (userId: number, name: string) => {
    setActingOn(userId);
    try {
      await apiRequest('/admin/users/approve', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success(`${name} approved — they can now log in.`);
      setPendingUsers(q => q.filter(u => u.id !== userId));
      void fetchActiveUsers(); // refresh the active list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve user');
    } finally {
      setActingOn(null);
    }
  };

  const handleReject = async (userId: number, name: string) => {
    setActingOn(userId);
    try {
      await apiRequest('/admin/users/reject', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success(`${name}'s registration was rejected.`);
      setPendingUsers(q => q.filter(u => u.id !== userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject user');
    } finally {
      setActingOn(null);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = activeUsers.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const studentCount = activeUsers.filter(u => u.role === 'student').length;
  const instructorCount = activeUsers.filter(u => u.role === 'instructor').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="User Management"
        description="Manage students, instructors, and pending registrations."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void fetchActiveUsers(); void fetchPendingUsers(); }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{activeUsers.length}</p>
                <p className="text-xs text-muted-foreground">Total active users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{studentCount}</p>
                <p className="text-xs text-muted-foreground">Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{instructorCount}</p>
                <p className="text-xs text-muted-foreground">Instructors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={cn(
                'grid h-9 w-9 place-items-center rounded-lg',
                pendingUsers.length > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
              )}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{pendingUsers.length}</p>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: All Users / Pending */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active Users
            {activeUsers.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {activeUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingUsers.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Active users tab ── */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">All Active Users</CardTitle>
                  <CardDescription>Every approved student and instructor on the platform</CardDescription>
                </div>
                <div className="relative max-w-xs w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading users…</p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {search ? 'No users match your search.' : 'No active users yet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-6 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 text-right font-medium">Enrollments</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map(u => (
                        <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{u.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn('capitalize', roleStyles[u.role])}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {u.courses_enrolled}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {relativeTime(u.joined_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pending approval tab ── */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base">Pending Registrations</CardTitle>
              <CardDescription>
                These users have verified their email but are waiting for admin approval before they can log in.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pendingLoading ? (
                <p className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading queue…</p>
              ) : pendingUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No pending registrations.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant="outline" className={cn('capitalize shrink-0', roleStyles[u.role] ?? '')}>
                        {u.role}
                      </Badge>
                      <p className="shrink-0 text-xs text-muted-foreground hidden sm:block">
                        {relativeTime(u.created_at)}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600"
                          disabled={actingOn === u.id}
                          onClick={() => void handleApprove(u.id, u.name)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={actingOn === u.id}
                          onClick={() => void handleReject(u.id, u.name)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
