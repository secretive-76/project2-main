import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Trophy, Clock, Flame, Zap, ArrowRight, Sparkles, BookOpen,
  CheckCircle2, PlayCircle, Award, Target, Upload,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { useAuth } from '@/components/providers/auth-provider';
import { apiRequest, getImageUrl } from '@/lib/api';
import { formatNumber, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type EnrollmentStatus = 'saved' | 'in-progress' | 'completed';

interface EnrollmentCourse {
  course_id: string;
  slug?: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  category?: string;
  instructor_name?: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at?: string;
}

interface DashboardActivity {
  type: 'lesson-completed' | 'course-completed' | 'quiz-passed' | 'assignment-submitted';
  title: string;
  detail: string;
  timestamp: string;
}

interface DashboardData {
  courses_completed: number;
  minutes_learned: number;
  hours_learned: number;
  current_streak: number;
  skill_points: number;
  quiz_attempts: number;
  quizzes_passed: number;
  assignments_submitted: number;
  completed_this_month: number;
  minutes_this_week: number;
  points_this_week: number;
  weekly_goal_minutes: number;
  recent_activity: DashboardActivity[];
}

const activityIcon: Record<DashboardActivity['type'], { icon: LucideIcon; className: string }> = {
  'lesson-completed': { icon: CheckCircle2, className: 'bg-success/10 text-success' },
  'course-completed': { icon: Trophy, className: 'bg-warning/10 text-warning' },
  'quiz-passed': { icon: Target, className: 'bg-primary/10 text-primary' },
  'assignment-submitted': { icon: Upload, className: 'bg-info/10 text-info' },
};

type DashboardCache = { token: string | null; dashboard: DashboardData; enrollments: EnrollmentCourse[] };
const dashboardCacheKey = 'akademia-dashboard-cache-v1';

function readDashboardCache(): DashboardCache | null {
  try {
    const raw = sessionStorage.getItem(dashboardCacheKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as DashboardCache;
    // A cache from another account must never be shown after sign-in.
    return value.token === localStorage.getItem('akademia-token') ? value : null;
  } catch {
    return null;
  }
}

function writeDashboardCache(dashboard: DashboardData, enrollments: EnrollmentCourse[]) {
  try {
    sessionStorage.setItem(dashboardCacheKey, JSON.stringify({
      token: localStorage.getItem('akademia-token'), dashboard, enrollments,
    } satisfies DashboardCache));
  } catch {
    // The live database result remains usable when browser storage is unavailable.
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const cached = readDashboardCache();
  const [dashboard, setDashboard] = useState<DashboardData | null>(() => cached?.dashboard ?? null);
  const [enrollments, setEnrollments] = useState<EnrollmentCourse[]>(() => cached?.enrollments ?? []);
  const [loading, setLoading] = useState(() => !cached);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [summaryResponse, enrollmentResponse] = await Promise.all([
          apiRequest('/student/dashboard') as Promise<DashboardData>,
          apiRequest('/student/enrollments') as Promise<{ enrollments?: EnrollmentCourse[] }>,
        ]);
        if (cancelled) return;
        const nextEnrollments = enrollmentResponse.enrollments ?? [];
        setDashboard(summaryResponse);
        setEnrollments(nextEnrollments);
        writeDashboardCache(summaryResponse, nextEnrollments);
      } catch {
        // Keep the last verified values visible during a temporary backend delay.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const ongoing = enrollments.filter((course) => course.status === 'in-progress');
  const completed = enrollments.filter((course) => course.status === 'completed');
  const activity = dashboard?.recent_activity ?? [];
  const achievements = activity.filter((item) => item.type === 'course-completed' || item.type === 'quiz-passed').slice(0, 4);
  const goal = dashboard?.weekly_goal_minutes ?? 300;
  const weeklyMinutes = dashboard?.minutes_this_week ?? 0;
  const weeklyPct = goal > 0 ? Math.min(100, Math.round((weeklyMinutes / goal) * 100)) : 0;

  const trend = (count: number, unit: string, zero: string) => count > 0
    ? `+${count}${unit}`
    : zero;

  return (
    <div className="space-y-6 animate-in-slide">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Learner'}`}
        description="Here's a summary of your learning journey."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/student/browse"><BookOpen className="mr-2 h-4 w-4" />Browse</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/student/ai-coach"><Sparkles className="mr-2 h-4 w-4" />Ask Akademia</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Courses completed" value={dashboard?.courses_completed ?? 0} icon={Trophy} accent="primary"
          trend={{ value: trend(dashboard?.completed_this_month ?? 0, ' this month', 'No completions this month'), positive: (dashboard?.completed_this_month ?? 0) > 0 }} />
        <StatCard label="Hours learned" value={formatHours(dashboard?.hours_learned ?? 0)} icon={Clock} accent="info"
          trend={{ value: trend(weeklyMinutes, 'm this week', 'No learning this week'), positive: weeklyMinutes > 0 }} />
        <StatCard label="Current streak" value={`${dashboard?.current_streak ?? 0} days`} icon={Flame} accent="warning"
          trend={{ value: (dashboard?.current_streak ?? 0) > 0 ? 'Active learning streak' : 'Start a lesson today', positive: (dashboard?.current_streak ?? 0) > 0 }} />
        <StatCard label="Skill points" value={formatNumber(dashboard?.skill_points ?? 0)} icon={Zap} accent="success"
          trend={{ value: trend(dashboard?.points_this_week ?? 0, ' this week', 'No points this week'), positive: (dashboard?.points_this_week ?? 0) > 0 }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {ongoing[0] ? <ContinueLearningCard course={ongoing[0]} /> : <EmptyLearningCard />}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly goal</CardTitle>
            <CardDescription>Time recorded from completed lessons</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-0">
            <ProgressRing value={weeklyPct} />
            <p className="mt-4 text-center text-sm font-medium text-foreground">{weeklyMinutes} / {goal} min this week</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {weeklyMinutes > 0 ? 'Keep going to reach your weekly goal.' : 'Complete a lesson to begin tracking time.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CourseListCard title="In progress" icon={PlayCircle} count={ongoing.length} courses={ongoing} />
        <CourseListCard title="Completed" icon={CheckCircle2} count={completed.length} courses={completed} completed />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-warning" />Recent achievements</CardTitle>
              <CardDescription>Unlocked from your course and quiz activity</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild><Link to="/student/achievements">All</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {achievements.length ? achievements.map((item) => (
              <div key={`${item.type}-${item.timestamp}`} className="flex gap-3 rounded-lg border p-3">
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-muted-foreground">{relativeTime(item.timestamp)}</p></div>
              </div>
            )) : <DashboardEmpty message="Complete a course or pass a quiz to unlock achievements." />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Your saved learning timeline</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length ? (
              <ol className="space-y-1">
                {activity.map((item) => {
                  const config = activityIcon[item.type];
                  const Icon = config.icon;
                  return (
                    <li key={`${item.type}-${item.timestamp}`} className="flex gap-3 pb-4 last:pb-0">
                      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', config.className)}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.timestamp)}</span>
                    </li>
                  );
                })}
              </ol>
            ) : <DashboardEmpty message="Your completed lessons, quizzes, and submissions will appear here." />}
          </CardContent>
        </Card>
      </div>

      {loading ? <p className="text-center text-sm text-muted-foreground">Loading your saved learning data…</p> : null}
    </div>
  );
}

function CourseListCard({ title, icon: Icon, count, courses, completed = false }: {
  title: string; icon: LucideIcon; count: number; courses: EnrollmentCourse[]; completed?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle className="flex items-center gap-2 text-base"><Icon className={cn('h-4 w-4', completed ? 'text-success' : 'text-primary')} />{title}</CardTitle><CardDescription>{count} courses</CardDescription></div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground"><Link to="/student/my-courses">View all<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {courses.length ? courses.slice(0, 3).map((course) => <CourseRow key={course.course_id} course={course} completed={completed} />) : <DashboardEmpty message={completed ? 'No completed courses yet.' : 'Enroll in an approved course to start learning.'} />}
      </CardContent>
    </Card>
  );
}

function ContinueLearningCard({ course }: { course: EnrollmentCourse }) {
  return (
    <Card className="relative col-span-1 overflow-hidden lg:col-span-2">
      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid aspect-video w-full shrink-0 place-items-center rounded-lg bg-primary/10 sm:w-56"><BookOpen className="h-10 w-10 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <Badge className="mb-2 gap-1 bg-primary/10 text-primary hover:bg-primary/10"><Sparkles className="h-3 w-3" />Continue learning</Badge>
          <h2 className="text-xl font-semibold">{course.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description || 'Continue with the next lesson in this course.'}</p>
          <Button className="mt-4" size="sm" asChild><Link to={`/student/courses/${course.slug || course.course_id}/learn`}>Resume lesson<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyLearningCard() {
  return <Card className="col-span-1 lg:col-span-2"><CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center"><BookOpen className="h-8 w-8 text-primary" /><h2 className="mt-3 font-semibold">Ready to start learning?</h2><p className="mt-1 text-sm text-muted-foreground">Approved instructor courses will appear in Browse.</p><Button className="mt-4" size="sm" asChild><Link to="/student/browse">Browse courses</Link></Button></CardContent></Card>;
}

function CourseRow({ course, completed }: { course: EnrollmentCourse; completed: boolean }) {
  return <Link to={`/student/courses/${course.slug || course.course_id}`} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
    <div className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">{course.thumbnail_url ? <img src={getImageUrl(course.thumbnail_url)} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium group-hover:text-primary">{course.title}</p><p className="text-xs text-muted-foreground">{completed ? 'Completed' : `By ${course.instructor_name || 'Instructor'}`}</p></div>
    {completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <PlayCircle className="h-5 w-5 text-primary" />}
  </Link>;
}

function DashboardEmpty({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{message}</p>;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}

function ProgressRing({ value }: { value: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return <div className="relative grid h-24 w-24 place-items-center"><svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88"><circle cx="44" cy="44" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" /><circle cx="44" cy="44" r={radius} fill="none" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" /></svg><span className="absolute text-lg font-semibold tabular-nums">{value}%</span></div>;
}
