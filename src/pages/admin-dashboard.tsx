import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Activity,
  Search,
  Clock,
  RefreshCcw,
  GraduationCap,
  X,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/page-header';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { initials, relativeTime } from '@/lib/format';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import type { UserRole } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminStatsResponse {
  total_users: number;
  total_students: number;
  total_instructors: number;
  total_courses: number;
  approved_courses: number;
  pending_courses: number;
  pending_users: number;
  total_enrollments: number;
  completion_rate: number;
  category_distribution: { category: string; courses: number }[];
  monthly_user_growth: { month: string; students: number }[];
  users: UserRow[];
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  joined_at: string;
  courses_enrolled: number;
}

interface QueueUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface CourseDetailRow {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  instructor_name: string;
  enrollment_count: number;
}

interface EnrollmentRow {
  course_id: string;
  title: string;
  instructor_name: string;
  total_enrolled: number;
  completed: number;
  in_progress: number;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const roleStyles: Record<string, string> = {
  student: 'bg-blue-500/10 text-blue-600 border-blue-200',
  instructor: 'bg-primary/10 text-primary border-primary/20',
  admin: 'bg-warning/10 text-warning border-warning/20',
};

const statusStyles: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
  disapproved: 'bg-red-500/10 text-red-600 border-red-200',
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

type ModalType = 'users' | 'courses' | 'enrollments' | null;

interface ModalProps {
  type: ModalType;
  onClose: () => void;
}

function DetailModal({ type, onClose }: ModalProps) {
  const [data, setData] = useState<UserRow[] | CourseDetailRow[] | EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    const endpoint =
      type === 'users' ? '/admin/users' :
      type === 'courses' ? '/admin/all-courses' :
      '/admin/enrollments';

    apiRequest(endpoint)
      .then((res: any) => {
        setData(
          type === 'users' ? res.users :
          type === 'courses' ? res.courses :
          res.enrollments
        );
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [type]);

  const title =
    type === 'users' ? 'All Users' :
    type === 'courses' ? 'All Courses' :
    'Enrollment Details';

  const description =
    type === 'users' ? 'Every approved student and instructor on the platform' :
    type === 'courses' ? 'All courses with instructor and status' :
    'Per-course enrollment breakdown';

  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const filteredUsers = (data as UserRow[]).filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });
  const filteredCourses = (data as CourseDetailRow[]).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.title?.toLowerCase().includes(q) || c.instructor_name?.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onBackdrop}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {(type === 'users' || type === 'courses') && (
          <div className="border-b border-border px-6 py-3">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={type === 'users' ? 'Search by name or email…' : 'Search by title or instructor…'}
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto">
          {loading ? (
            <p className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading…</p>
          ) : (

            /* ── Users table ── */
            type === 'users' ? (
              filteredUsers.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No users found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 text-right font-medium">Enrollments</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-accent/40">
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
                        <td className="px-4 py-3 text-muted-foreground">{relativeTime(u.joined_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )

            /* ── Courses table ── */
            ) : type === 'courses' ? (
              filteredCourses.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No courses found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Instructor</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCourses.map(c => (
                      <tr key={c.id} className="hover:bg-accent/40">
                        <td className="px-6 py-3">
                          <p className="truncate font-medium text-foreground max-w-[220px]">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{relativeTime(c.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.instructor_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.category}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn('capitalize', statusStyles[c.status] ?? '')}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {c.enrollment_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )

            /* ── Enrollments table ── */
            ) : (
              (data as EnrollmentRow[]).length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No enrollment data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Course</th>
                      <th className="px-4 py-3 font-medium">Instructor</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-right font-medium">Completed</th>
                      <th className="px-4 py-3 text-right font-medium">In Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data as EnrollmentRow[]).map(e => (
                      <tr key={e.course_id} className="hover:bg-accent/40">
                        <td className="px-6 py-3 font-medium text-foreground max-w-[220px]">
                          <p className="truncate">{e.title}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.instructor_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{e.total_enrolled}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{e.completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">{e.in_progress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clickable stat card ───────────────────────────────────────────────────────

interface ClickableCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
  onClick: () => void;
  highlight?: boolean;
}

function ClickableCard({ label, value, icon: Icon, onClick, highlight }: ClickableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-xl border bg-card p-5 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary',
        highlight ? 'border-warning/40 bg-warning/5' : 'border-border hover:border-primary/30',
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('grid h-10 w-10 place-items-center rounded-lg', highlight ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary')}>
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <p className={cn('mt-4 text-2xl font-semibold tracking-tight tabular-nums', highlight ? 'text-warning' : 'text-foreground')}>
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // User queue state
  const [queue, setQueue] = useState<QueueUser[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [actingOn, setActingOn] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/stats') as AdminStatsResponse;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const data = await apiRequest('/admin/users/queue') as { users: QueueUser[] };
      setQueue(data.users ?? []);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    void fetchQueue();
  }, [fetchStats, fetchQueue]);

  const handleApprove = async (userId: number, name: string) => {
    setActingOn(userId);
    try {
      await apiRequest('/admin/users/approve', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success(`${name} approved — they can now log in.`);
      setQueue(q => q.filter(u => u.id !== userId));
      void fetchStats();
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
      setQueue(q => q.filter(u => u.id !== userId));
      void fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject user');
    } finally {
      setActingOn(null);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="animate-pulse text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error ?? 'No data available.'}</p>
        <Button size="sm" onClick={() => void fetchStats()}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Detail modal */}
      {activeModal && (
        <DetailModal type={activeModal} onClose={() => setActiveModal(null)} />
      )}

      <div className="space-y-8 animate-in-slide">
        <PageHeader
          title="Admin Dashboard"
          description="Live platform overview — users, courses, enrollments."
          actions={
            <Button variant="outline" size="sm" onClick={() => { void fetchStats(); void fetchQueue(); }}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        {/* Alert banners */}
        <div className="flex flex-col gap-3">
          {stats.pending_users > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
              <Clock className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {stats.pending_users} user{stats.pending_users !== 1 ? 's' : ''} awaiting approval
                </p>
                <p className="text-xs text-muted-foreground">See the User Queue section below.</p>
              </div>
            </div>
          )}
          {stats.pending_courses > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {stats.pending_courses} course{stats.pending_courses !== 1 ? 's' : ''} awaiting review
                </p>
                <p className="text-xs text-muted-foreground">
                  Go to <strong>Course Moderation</strong> to approve or reject them.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Clickable stat cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <ClickableCard
            label="Total users"
            value={stats.total_users}
            icon={Users}
            onClick={() => setActiveModal('users')}
          />
          <ClickableCard
            label="Active courses"
            value={stats.approved_courses}
            icon={BookOpen}
            onClick={() => setActiveModal('courses')}
          />
          <ClickableCard
            label="Total enrollments"
            value={stats.total_enrollments}
            icon={GraduationCap}
            onClick={() => setActiveModal('enrollments')}
          />
          <ClickableCard
            label="Completion rate"
            value={`${stats.completion_rate.toFixed(1)}%`}
            icon={CheckCircle2}
            onClick={() => setActiveModal('enrollments')}
          />
        </div>

        {/* Role + course breakdown */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <button type="button" onClick={() => setActiveModal('users')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md">
            <p className="text-xs text-muted-foreground">Students</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total_students}</p>
          </button>
          <button type="button" onClick={() => setActiveModal('users')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md">
            <p className="text-xs text-muted-foreground">Instructors</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total_instructors}</p>
          </button>
          <button type="button" onClick={() => setActiveModal('courses')}
            className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-md">
            <p className="text-xs text-muted-foreground">Total courses</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total_courses}</p>
          </button>
          <ClickableCard
            label="Pending review"
            value={stats.pending_courses}
            icon={Clock}
            onClick={() => setActiveModal('courses')}
            highlight={stats.pending_courses > 0}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">User growth</CardTitle>
              <CardDescription>New registrations per month (last 7 months)</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.monthly_user_growth.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                  No registration data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={stats.monthly_user_growth} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => [v, 'New users']}
                    />
                    <Area type="monotone" dataKey="students" stroke="hsl(var(--info))" strokeWidth={2} fill="url(#userGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course categories</CardTitle>
              <CardDescription>Distribution by topic</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.category_distribution.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No courses yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.category_distribution} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={90} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => [`${v} course${v !== 1 ? 's' : ''}`, '']}
                    />
                    <Bar dataKey="courses" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── User Queue ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-blue-500" />
                  User Queue
                  {queue.length > 0 && (
                    <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {queue.length}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  New registrations waiting for admin approval before they can log in
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void fetchQueue()}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {queueLoading ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground animate-pulse">Loading queue…</p>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground">No pending registrations.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {queue.map(user => (
                  <div key={user.id} className="flex items-center gap-4 px-6 py-4">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="outline" className={cn('capitalize shrink-0', roleStyles[user.role])}>
                      {user.role}
                    </Badge>
                    <p className="shrink-0 text-xs text-muted-foreground hidden sm:block">
                      {relativeTime(user.created_at)}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-500 text-white hover:bg-emerald-600"
                        disabled={actingOn === user.id}
                        onClick={() => void handleApprove(user.id, user.name)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={actingOn === user.id}
                        onClick={() => void handleReject(user.id, user.name)}
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

        {/* Platform summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Platform summary
            </CardTitle>
            <CardDescription>Aggregated course and engagement data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <button type="button" onClick={() => setActiveModal('courses')}
                className="group rounded-lg border border-border p-4 text-center transition-all hover:border-primary/30 hover:shadow-sm">
                <BookOpen className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p className="text-2xl font-bold tabular-nums">{stats.total_courses}</p>
                <p className="text-xs text-muted-foreground">Total courses</p>
              </button>
              <button type="button" onClick={() => setActiveModal('courses')}
                className="group rounded-lg border border-border p-4 text-center transition-all hover:border-primary/30 hover:shadow-sm">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
                <p className="text-2xl font-bold tabular-nums">{stats.approved_courses}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </button>
              <button type="button" onClick={() => setActiveModal('courses')}
                className="group rounded-lg border border-border p-4 text-center transition-all hover:border-warning/30 hover:shadow-sm">
                <Clock className="mx-auto mb-2 h-5 w-5 text-warning" />
                <p className="text-2xl font-bold tabular-nums text-warning">{stats.pending_courses}</p>
                <p className="text-xs text-muted-foreground">Pending review</p>
              </button>
              <button type="button" onClick={() => setActiveModal('enrollments')}
                className="group rounded-lg border border-border p-4 text-center transition-all hover:border-primary/30 hover:shadow-sm">
                <TrendingUp className="mx-auto mb-2 h-5 w-5 text-info" />
                <p className="text-2xl font-bold tabular-nums">{stats.total_enrollments}</p>
                <p className="text-xs text-muted-foreground">Enrollments</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
