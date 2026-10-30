import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, Clock, CircleCheck as CheckCircle2, CirclePlay as PlayCircle, Award, ArrowRight, Download, Lock, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { courseCertificates } from '@/lib/mock-data';
import { useLessonProgress } from '@/hooks/use-lesson-progress';
import { getAllLessons } from '@/lib/course-utils';
import { useStudentPortalState } from '@/lib/student-api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Course, CourseCertificate } from '@/types';
import { apiRequest, getImageUrl } from '@/lib/api';

type TabKey = 'ongoing' | 'completed' | 'pending';

export function MyCoursesPage() {
  const [tab, setTab] = useState<TabKey>('ongoing');
  const [search, setSearch] = useState('');
  // Subscribing here makes Ongoing/Completed/Saved update as soon as the Go API
  // confirms an enrollment or lesson completion.
  const { state } = useStudentPortalState();
  type EnrolledCourse = Course & { resumeLessonId?: string };
  const [studentCourses, setStudentCourses] = useState<EnrolledCourse[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadEnrolledCourses = async () => {
      try {
        const data = await apiRequest('/student/enrollments');
        if (cancelled) return;
        const enrolledCourses = Array.isArray(data.enrollments) ? data.enrollments : [];
        setStudentCourses(enrolledCourses.map((item: {
          course_id: string;
          slug?: string;
          title: string;
          description?: string;
          thumbnail_url?: string;
          category?: string;
          difficulty?: Course['difficulty'];
          instructor_name?: string;
          status: 'saved' | 'in-progress' | 'completed';
          resume_lesson_id?: string;
        }) => ({
          id: item.course_id,
          slug: item.slug || item.course_id,
          title: item.title,
          subtitle: item.description || 'Enrolled course',
          description: item.description || '',
          category: item.category || 'General',
          difficulty: item.difficulty || 'Beginner',
          thumbnailUrl: getImageUrl(item.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
          rating: 0,
          reviews: 0,
          enrolled: 1,
          durationHours: 1,
          instructor: { id: '', name: item.instructor_name || 'Akademia Instructor', title: 'Instructor', avatarUrl: '', rating: 0, students: 0 },
          tags: [],
          modules: [],
          status: item.status === 'completed' ? 'completed' : item.status === 'in-progress' ? 'in-progress' : 'not-started',
          progress: item.status === 'completed' ? 100 : 0,
          resumeLessonId: item.resume_lesson_id || undefined,
        })));
      } catch {
        if (!cancelled) setStudentCourses([]);
      }
    };
    void loadEnrolledCourses();
    return () => { cancelled = true; };
  }, [state]);
  const ongoing = studentCourses.filter((course) => course.status === 'in-progress');
  const completed = studentCourses.filter((course) => course.status === 'completed');
  const pending = studentCourses.filter((course) => course.status === 'not-started');

  const filtered = useMemo(() => {
    let source: Course[];
    switch (tab) {
      case 'completed':
        source = completed;
        break;
      case 'pending':
        source = pending;
        break;
      default:
        source = ongoing;
    }
    if (!search.trim()) return source;
    return source.filter(
      (c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    );
  }, [tab, search, ongoing, completed, pending]);

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="My Courses"
        description="Track your progress, resume where you left off, and celebrate completions."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <QuickStat icon={PlayCircle} label="Ongoing" value={ongoing.length} accent="text-primary bg-primary/10" />
        <QuickStat icon={CheckCircle2} label="Completed" value={completed.length} accent="text-success bg-success/10" />
        <QuickStat icon={Lock} label="Saved" value={pending.length} accent="text-warning bg-warning/10" />
        <QuickStat
          icon={Award}
          label="Certificates"
          value={completed.length}
          accent="text-info bg-info/10"
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="ongoing" className="gap-1.5">
              <PlayCircle className="h-3.5 w-3.5" />
              Ongoing
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {ongoing.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {completed.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Pending
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {pending.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {tab === 'completed' && (
        <CompletedSection courses={filtered} certificates={courseCertificates} />
      )}

      {tab === 'ongoing' && (
        <div className="space-y-5">
          {filtered.length > 0 ? (
            filtered.map((course) => <OngoingCourseRow key={course.id} course={course} />)
          ) : (
            <EmptyState search={search} />
          )}
        </div>
      )}

      {tab === 'pending' && (
        <div className="space-y-5">
          {filtered.length > 0 ? (
            filtered.map((course) => <PendingCourseRow key={course.id} course={course} />)
          ) : (
            <EmptyState search={search} />
          )}
        </div>
      )}
    </div>
  );
}

function CompletedSection({
  courses: completedCourses,
  certificates,
}: {
  courses: Course[];
  certificates: CourseCertificate[];
}) {
  if (completedCourses.length === 0) {
    return <EmptyState search="" />;
  }

  return (
    <div className="space-y-8">
      {completedCourses.map((course) => {
        const cert = certificates.find((c) => c.courseId === course.id);
        return (
          <div key={course.id} className="space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-40">
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 grid place-items-center bg-black/20">
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="gap-1 bg-success/10 text-success hover:bg-success/10">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </Badge>
                      {cert && (
                        <Badge variant="outline" className="gap-1 text-info border-info/20">
                          <Award className="h-3 w-3" />
                          Certified
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-foreground">{course.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {course.subtitle}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>By {course.instructor.name}</span>
                      <span>{formatDuration(course.durationHours * 60)}</span>
                      <span>{course.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/student/courses/${course.slug}`}>
                        Review course
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {cert && (
                      <Button size="sm" variant="ghost" className="text-info">
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Certificate
                      </Button>
                    )}
                  </div>
                </div>

                {/* Certificate details */}
                {cert && (
                  <div className="border-t border-border bg-info/5 p-4">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-info" />
                        <span className="font-medium text-foreground">Certificate ID:</span>
                        <span className="text-muted-foreground">{cert.certificateId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Completed on {new Date(cert.completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function OngoingCourseRow({ course }: { course: Course & { resumeLessonId?: string } }) {
  const { completedLessons } = useLessonProgress(course.id);
  const allLessons = useMemo(() => getAllLessons(course), [course]);
  const completed = allLessons.filter((l) => completedLessons.has(l.id)).length;
  const total = allLessons.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : course.progress;
  const lastCompletedIdx = allLessons.reduce((last, l, i) => (completedLessons.has(l.id) ? i : last), -1);
  // The server chooses the first unfinished lesson. It works even before the
  // course player has loaded its full curriculum into this page.
  const resumeLesson = course.resumeLessonId || allLessons[Math.min(lastCompletedIdx + 1, total - 1)]?.id || allLessons[0]?.id;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-40">
          <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <PlayCircle className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Badge className="mb-2 gap-1 bg-primary/10 text-primary hover:bg-primary/10">
            <TrendingUp className="h-3 w-3" />
            In Progress
          </Badge>
          <h3 className="font-semibold text-foreground">{course.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{course.subtitle}</p>
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {completed} of {total} lessons completed
              </span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button size="sm" asChild>
            <Link to={`/student/courses/${course.slug}/learn${resumeLesson ? `?lesson=${encodeURIComponent(resumeLesson)}` : ''}`}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Resume
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
            <Link to={`/student/courses/${course.slug}`}>
              Course details
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingCourseRow({ course }: { course: Course }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-40">
          <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <Lock className="h-7 w-7 text-white/80" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Badge variant="outline" className="mb-2 gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            Not Started
          </Badge>
          <h3 className="font-semibold text-foreground">{course.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{course.subtitle}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span>By {course.instructor.name}</span>
            <span>{formatDuration(course.durationHours * 60)}</span>
            <span>{course.difficulty}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to={`/student/courses/${course.slug}/learn`}>
            Start course
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No courses found</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {search ? 'Try a different search term.' : 'Browse the catalog to enroll in a course.'}
      </p>
      <Button asChild className="mt-4" size="sm">
        <Link to="/student/browse">Browse courses</Link>
      </Button>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('grid h-10 w-10 place-items-center rounded-lg', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
