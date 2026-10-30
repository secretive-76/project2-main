import { useEffect, useState } from 'react';
import {
  Users,
  Star,
  Plus,
  BarChart3,
  GraduationCap,
  PlayCircle,
  Edit3,
  MoreVertical,
  Trash2,
  ExternalLink,
  Sparkles,
  RefreshCcw,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from 'recharts';
import { formatNumber, initials } from '@/lib/format';
import { apiRequest, resolveBackendAssetUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types matching the backend responses
// ---------------------------------------------------------------------------
interface CourseRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  thumbnail_url: string;
  status: string;
  student_count: number;
  avg_rating: number;
  completion_rate: number;
}

interface StudentRow {
  id: number;
  name: string;
  email: string;
  enrolled_course: string;
  progress: number;
  last_active: string;
  status: 'active' | 'completed' | 'at-risk';
}

interface ReviewRow {
  id: number;
  student_name: string;
  course_title: string;
  rating: number;
  message: string;
  created_at: string;
}

interface DashboardStats {
  total_students: number;
  new_students_this_month: number;
  avg_rating: number;
  monthly_enrollments: { month: string; students: number }[];
}

const statusStyles: Record<string, string> = {
  approved: 'bg-success/10 text-success border-success/20',
  pending: 'bg-warning/10 text-warning border-warning/20',
  disapproved: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabel: Record<string, string> = {
  approved: 'Published',
  pending: 'In review',
  disapproved: 'Disapproved',
};

const studentStatusStyle: Record<string, string> = {
  active: 'bg-success/10 text-success',
  completed: 'bg-primary/10 text-primary',
  'at-risk': 'bg-warning/10 text-warning',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export function InstructorDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsData, coursesData, studentsData, reviewsData] = await Promise.all([
        apiRequest('/instructor/dashboard') as Promise<DashboardStats>,
        apiRequest('/instructor/courses') as Promise<{ courses: CourseRow[] }>,
        apiRequest('/instructor/students') as Promise<{ students: any[] }>,
        apiRequest('/course-feedback') as Promise<{ feedback: any[] }>,
      ]);

      setStats(statsData);
      setCourses(coursesData.courses ?? []);

      // Map students — take the 8 most recently active
      setStudents(
        (studentsData.students ?? []).slice(0, 8).map((s: any) => ({
          id: s.id,
          name: s.name ?? 'Student',
          email: s.email ?? '',
          enrolled_course: s.enrolled_course ?? s.course_id ?? '—',
          progress: s.progress ?? 0,
          last_active: s.last_active
            ? new Date(s.last_active).toLocaleDateString()
            : '—',
          status: (s.status as StudentRow['status']) ?? 'active',
        }))
      );

      // Map reviews — take the 5 most recent
      setReviews(
        (reviewsData.feedback ?? []).slice(0, 5).map((f: any) => ({
          id: f.id,
          student_name: f.student_name ?? 'Student',
          course_title: f.course_title ?? f.course_id ?? '—',
          rating: f.rating ?? 0,
          message: f.message ?? '',
          created_at: f.created_at
            ? new Date(f.created_at).toLocaleDateString()
            : '—',
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchAll(); }, []);

  // Derived stats
  const totalStudents = stats?.total_students ?? 0;
  const newStudents = stats?.new_students_this_month ?? 0;
  const avgRating = stats?.avg_rating ?? 0;
  const publishedCourses = courses.filter((c) => c.status === 'approved').length;
  const otherCourses = courses.length - publishedCourses;
  const topCourse = courses[0] ?? null;
  const monthlyData = stats?.monthly_enrollments ?? [];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Instructor Dashboard"
        description="Track course performance, student engagement, and growth."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAnalyticsOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            </Button>
            <Button
              size="sm"
              className="bg-indigo hover:bg-indigo/90 text-indigo-foreground"
              onClick={() => navigate('/instructor/courses')}
            >
              <Plus className="mr-2 h-4 w-4" /> New course
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total students"
          value={formatNumber(totalStudents)}
          icon={Users}
          accent="primary"
          trend={{ value: `+${formatNumber(newStudents)} this month`, positive: newStudents > 0 }}
        />
        <StatCard
          label="Avg. rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : '—'}
          icon={Star}
          accent="warning"
          trend={{ value: 'Across all courses', positive: true }}
        />
        <StatCard
          label="Published courses"
          value={publishedCourses}
          icon={GraduationCap}
          accent="info"
          trend={{ value: `${otherCourses} in review / draft`, positive: false }}
        />
        <StatCard
          label="Monthly growth"
          value={newStudents > 0 ? `+${formatNumber(newStudents)}` : '0'}
          icon={TrendingUp}
          accent="success"
          trend={{ value: 'New enrollments (30 days)', positive: newStudents > 0 }}
        />
      </div>

      {/* Enrollment trend chart + top course */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Enrollment trend</CardTitle>
            <CardDescription>Monthly new students — last 7 months</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No enrollment data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="enrollGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(v: number) => [v, 'Students']}
                  />
                  <Area type="monotone" dataKey="students" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#enrollGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top course */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top course</CardTitle>
            <CardDescription>By enrollment</CardDescription>
          </CardHeader>
          <CardContent>
            {!topCourse ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No courses yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  {topCourse.thumbnail_url ? (
                    <img src={resolveBackendAssetUrl(topCourse.thumbnail_url)} alt={topCourse.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <PlayCircle className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 grid place-items-center bg-black/20">
                    <PlayCircle className="h-10 w-10 text-background/90" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-2">{topCourse.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" />{formatNumber(topCourse.student_count)}</span>
                    {topCourse.avg_rating > 0 && (
                      <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{topCourse.avg_rating}</span>
                    )}
                  </div>
                  {topCourse.completion_rate > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Completion rate</span>
                        <span className="font-medium text-foreground">{topCourse.completion_rate}%</span>
                      </div>
                      <Progress value={topCourse.completion_rate} className="h-1.5" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your courses</CardTitle>
          <CardDescription>Performance across all courses</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {courses.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No courses found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Course</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Students</th>
                    <th className="px-4 py-3 text-right font-medium">Rating</th>
                    <th className="px-4 py-3 text-right font-medium">Completion</th>
                    <th className="px-6 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {courses.map((course) => (
                    <tr key={course.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {course.thumbnail_url ? (
                            <img src={resolveBackendAssetUrl(course.thumbnail_url)} alt={course.title} className="h-10 w-16 shrink-0 rounded-md object-cover bg-muted" />
                          ) : (
                            <div className="h-10 w-16 shrink-0 rounded-md bg-muted flex items-center justify-center">
                              <PlayCircle className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                          <span className="font-medium text-foreground line-clamp-2">{course.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn('capitalize', statusStyles[course.status] ?? 'bg-muted text-muted-foreground')}>
                          {statusLabel[course.status] ?? course.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatNumber(course.student_count)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {course.avg_rating > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            {course.avg_rating}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {course.completion_rate > 0 ? `${course.completion_rate}%` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/instructor/courses?edit=${encodeURIComponent(course.id)}`)}>
                              <Edit3 className="mr-2 h-4 w-4" /> Edit Course
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/courses/${course.id}`)}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Preview Live
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students + Reviews */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent students</CardTitle>
            <CardDescription>Recently active across your courses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No students yet.</p>
            ) : (
              students.map((student) => (
                <div key={`${student.id}-${student.enrolled_course}`} className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent/50">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs">{initials(student.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{student.enrolled_course}</p>
                  </div>
                  <div className="hidden w-24 sm:block">
                    <Progress value={student.progress} className="h-1.5" />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{student.progress}%</span>
                  <Badge variant="outline" className={cn('hidden shrink-0 text-[10px] sm:flex', studentStatusStyle[student.status])}>
                    {student.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent reviews</CardTitle>
            <CardDescription>What students are saying</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="flex gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs">{initials(review.student_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium text-foreground">{review.student_name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{review.created_at}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{review.course_title}</p>
                    <div className="mt-1 flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={cn('h-3 w-3', i < review.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
                      ))}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">"{review.message}"</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Modal */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo" /> Detailed Analytics
            </DialogTitle>
            <DialogDescription>Performance metrics across your instructor portfolio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Students</p>
                <p className="mt-1 text-lg font-bold text-foreground">{formatNumber(totalStudents)}</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg. Rating</p>
                <p className="mt-1 text-lg font-bold text-foreground">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">New (30 days)</p>
                <p className="mt-1 text-lg font-bold text-foreground">+{formatNumber(newStudents)}</p>
              </div>
            </div>
            {topCourse && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo" /> Top Performing Course
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">"{topCourse.title}"</strong> leads with{' '}
                  <strong className="text-foreground">{formatNumber(topCourse.student_count)}</strong> enrolled students
                  {topCourse.avg_rating > 0 && <> and a <strong className="text-foreground">{topCourse.avg_rating}</strong>-star rating</>}.
                  {topCourse.completion_rate > 0 && <> Completion rate: <strong className="text-foreground">{topCourse.completion_rate}%</strong>.</>}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAnalyticsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
