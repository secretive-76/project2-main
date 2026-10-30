import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Star,
  Clock,
  Users,
  PlayCircle,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  Video,
  ListChecks,
  ClipboardCheck,
  MessageSquare,
  Award,
  Globe,
  Lock,
  Download,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getCourseBySlug, getAllLessons } from '@/lib/course-utils';
import { formatNumber, formatDuration, initials } from '@/lib/format';
import { useLessonProgress } from '@/hooks/use-lesson-progress';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { enrollStudent, submitStudentFeedback, useStudentPortalState } from '@/lib/student-api';
import { toast } from 'sonner';
import type { Course, Lesson } from '@/types';
import { apiRequest, getImageUrl, resolveBackendAssetUrl } from '@/lib/api';
import { CourseMessaging } from '@/components/player/course-messaging';

const lessonTypeIcon: Record<Lesson['type'], typeof Video> = {
  video: Video,
  reading: FileText,
  quiz: ListChecks,
  assignment: ClipboardCheck,
  'ai-coaching': MessageSquare,
};

// The catalog hands this page a preview immediately; the full course is cached after
// the first fetch so returning to it never recreates a blank loading screen.
const courseDetailCache = new Map<string, Course>();

function getStoredCoursePreview(reference: string): Course | undefined {
  try {
    const raw = sessionStorage.getItem('akademia-course-previews');
    const previews = raw ? JSON.parse(raw) as Course[] : [];
    return previews.find((course) => course.id === reference || course.slug === reference);
  } catch {
    return undefined;
  }
}

const difficultyStyles: Record<string, string> = {
  Beginner: 'bg-success/10 text-success border-success/20',
  Intermediate: 'bg-info/10 text-info border-info/20',
  Advanced: 'bg-warning/10 text-warning border-warning/20',
};

export function CourseDetailPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const courseReference = id || slug || '';
  const previewCourse = (location.state as { coursePreview?: Course } | null)?.coursePreview;
  const storedPreview = useMemo(() => courseReference ? getStoredCoursePreview(courseReference) : undefined, [courseReference]);
  const visiblePreview = previewCourse ?? storedPreview;
  const cachedCourse = courseReference ? courseDetailCache.get(courseReference) : undefined;
  const { state } = useStudentPortalState();
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [course, setCourse] = useState<Course | undefined>(() => cachedCourse ?? visiblePreview);
  const [loading, setLoading] = useState(() => !(cachedCourse ?? visiblePreview));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [discussions, setDiscussions] = useState<import('@/lib/student-api').Discussion[]>([]);

  useEffect(() => {
    let cancelled = false;

    const resolveCourse = async () => {
      try {
        if (!courseReference) {
          if (!cancelled) { setCourse(undefined); setLoading(false); }
          return;
        }
        const cached = courseDetailCache.get(courseReference);
        if (cached && !cancelled) {
          setCourse(cached);
          setLoading(false);
        } else if (visiblePreview && !cancelled) {
          setCourse(visiblePreview);
          setLoading(false);
        }
        {
          const data = await apiRequest(`/courses/${encodeURIComponent(courseReference)}`);
          // Display course data immediately. Assignment submission badges are
          // supplemental and must never delay this page.
          const mapped = {
            id: data.id,
            slug: data.slug || data.id,
            title: data.title,
            subtitle: data.description || 'Live course from the Akademia platform',
            description: data.description || 'No description provided.',
            category: data.category || 'General',
            difficulty: (data.difficulty as any) || 'Beginner',
            thumbnailUrl: resolveBackendAssetUrl(data.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
            rating: 5,
            reviews: 0,
            enrolled: 0,
            durationHours: 1,
            instructor: { id: String(data.instructor?.id ?? data.id), name: data.instructor?.name ?? 'Instructor', title: 'Instructor', avatarUrl: '', rating: 5, students: 0 },
            tags: [],
            modules: (data.modules || []).map((module: any) => ({
              id: module.id,
              title: module.title,
              lessons: (module.lessons || []).map((lesson: any) => ({
                id: lesson.id,
                title: lesson.title,
                durationMinutes: lesson.duration_minutes || 0,
                timeLimitMinutes: lesson.duration_minutes || 10,
                type: String(lesson.lesson_type || lesson.type || 'video').toLowerCase(),
                completed: false,
                videoUrl: resolveBackendAssetUrl(lesson.video_path),
                pdfUrl: resolveBackendAssetUrl(lesson.resource_path),
                readingContent: lesson.content || undefined,
                  quizQuestions: Array.isArray(lesson.quiz_questions || lesson.quizQuestions)
                    ? (lesson.quiz_questions || lesson.quizQuestions).map((question: any) => ({
                        question: question.question || '',
                        choices: Array.isArray(question.choices) ? question.choices : [],
                      }))
                    : [],
                  quizQuestionCount: lesson.quiz_question_count ?? (Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions.length : 0),
                  quizTotalMarks: lesson.quiz_total_marks ?? (Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions.length : 0),
                  assignmentTitle: lesson.assignment_title || undefined,
                  assignmentDescription: lesson.assignment_instructions || undefined,
                  assignmentPoints: lesson.assignment_points || undefined,
                  assignmentSubmitted: false,
                resources: [
                  ...(lesson.resource_path
                    ? [{ label: lesson.title + ' — Material', url: resolveBackendAssetUrl(lesson.resource_path) }]
                    : []),
                  ...(lesson.video_path
                    ? [{ label: lesson.title + ' — Video', url: resolveBackendAssetUrl(lesson.video_path) }]
                    : []),
                ],
              })),
            })),
            status: 'not-started',
            progress: 0,
          } as any;
          courseDetailCache.set(data.id, mapped);
          if (data.slug) courseDetailCache.set(data.slug, mapped);
          if (!cancelled) setCourse(mapped);
          // Hydrate submitted-assignment badges after the page is visible.
          void import('@/lib/student-api')
            .then(({ getMyAssignmentSubmissions }) => getMyAssignmentSubmissions())
            .then((submissions) => {
              if (cancelled) return;
              const submittedLessonIds = new Set(submissions.map((item) => item.lesson_id));
              setCourse((current) => current ? {
                ...current,
                modules: current.modules.map((module) => ({
                  ...module,
                  lessons: module.lessons.map((lesson) => ({
                    ...lesson,
                    assignmentSubmitted: Boolean(lesson.assignmentSubmitted) || submittedLessonIds.has(lesson.id),
                  })),
                })),
              } : current);
            })
            .catch(() => undefined);
          return;
        }

        if (slug) {
          const localCourse = getCourseBySlug(slug ?? '');
          if (localCourse) {
            if (!cancelled) setCourse(localCourse);
            return;
          }
        }

        if (!cancelled) setCourse(undefined);
      } catch {
        if (!cancelled) setCourse(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolveCourse();
    return () => { cancelled = true; };
  }, [courseReference, visiblePreview, user?.role]);

  const { isCompleted, markComplete } = useLessonProgress(course?.id ?? '');

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading course details…</div>;
  }

  if (!course) {
    return <Navigate to="/student/browse" replace />;
  }

  const allLessons = getAllLessons(course);
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => isCompleted(l.id)).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const firstLesson = allLessons[0];
  const enrollment = state.enrollments.find((item) => item.course_id === course.id);
  const isEnrolled = Boolean(enrollment) || course.status !== 'not-started' || progressPct > 0;
  const isInstructorPreview = user?.role === 'instructor';
  const isInstructorOwner = isInstructorPreview && String(user?.id) === String(course.instructor.id);
  const canAccessMaterials = isEnrolled || isInstructorOwner || user?.role === 'admin';

  const deleteCourse = async () => {
    if (!isInstructorOwner || !window.confirm('Delete this course permanently?')) return;
    const token = localStorage.getItem('akademia-token');
    const response = await fetch(`http://localhost:8081/api/courses/delete?course_id=${encodeURIComponent(course.id)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(data.message || 'Could not delete course.');
      return;
    }
    toast.success('Course deleted.');
    navigate('/instructor/courses');
  };

  const startOrEnroll = async () => {
    if (!isEnrolled) {
      setEnrolling(true);
      try {
        await enrollStudent(course.id);
        toast.success('You are enrolled — enjoy the course!');
      } catch {
        toast.error('Could not enroll. Check that the Go backend is running.');
        setEnrolling(false);
        return;
      }
      setEnrolling(false);
    }
    navigate(`/student/courses/${course.slug}/learn${firstLesson ? `?lesson=${firstLesson.id}` : ''}`);
  };

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      toast.error('Please write your feedback before submitting.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await submitStudentFeedback(course.id, feedbackRating, feedbackMessage.trim());
      setFeedbackMessage('');
      toast.success('Thank you — your feedback was sent to the instructor and admin.');
    } catch {
      toast.error('Could not submit feedback. Check that the Go backend is running.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="animate-in-slide space-y-8">
      {/* Breadcrumb */}
      <Link
        to={isInstructorPreview ? '/instructor/dashboard' : '/student/browse'}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isInstructorPreview ? 'Back to dashboard' : 'Back to catalog'}
      </Link>

      {/* Hero */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{course.category}</Badge>
            <Badge className={cn('border-0', difficultyStyles[course.difficulty])}>
              {course.difficulty}
            </Badge>
            {course.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {course.title}
          </h1>
          <p className="text-balance text-lg text-muted-foreground">{course.subtitle}</p>

          <div className="flex flex-wrap items-center gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-medium text-foreground">{course.rating}</span>
              <span className="text-muted-foreground">({formatNumber(course.reviews)} reviews)</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              {formatNumber(course.enrolled)} enrolled
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDuration(course.durationHours * 60)}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <PlayCircle className="h-4 w-4" />
              {totalLessons} lessons
            </span>
          </div>

          {/* Instructor */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.name} />
              <AvatarFallback>{initials(course.instructor.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Instructor</p>
              <p className="truncate font-semibold text-foreground">{course.instructor.name}</p>
              <p className="truncate text-sm text-muted-foreground">{course.instructor.title}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {course.instructor.rating}
              </p>
              <p className="text-xs text-muted-foreground">{formatNumber(course.instructor.students)} students</p>
            </div>
          </div>

          <p className="text-pretty leading-relaxed text-muted-foreground">{course.description}</p>
        </div>

        {/* Sidebar card */}
        <div className="lg:row-span-2">
          <div className="lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <img src={getImageUrl(course.thumbnailUrl)} alt={course.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 grid place-items-center bg-black/30">
                  <PlayCircle className="h-14 w-14 text-background/90" />
                </div>
              </div>
              <CardContent className="space-y-4 p-5">
                {isInstructorOwner && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to={`/instructor/courses?edit=${encodeURIComponent(course.id)}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => void deleteCourse()}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete course</span>
                    </Button>
                  </div>
                )}
                {isEnrolled && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Your progress</span>
                      <span className="font-medium text-foreground">{progressPct}%</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {completedCount} of {totalLessons} lessons completed
                    </p>
                  </div>
                )}

                {!isInstructorPreview && (
                  <Button className="w-full" size="lg" onClick={startOrEnroll} disabled={enrolling}>
                      {isEnrolled ? (
                        <>
                          <PlayCircle className="mr-2 h-5 w-5" />
                          {progressPct > 0 ? 'Continue learning' : 'Start course'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          {enrolling ? 'Enrolling…' : 'Enroll for free'}
                        </>
                      )}
                  </Button>
                )}

                {isEnrolled && !isInstructorPreview && (
                  <Button variant="outline" className="w-full" onClick={() => setIsChatOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Course chat & support
                  </Button>
                )}

                <div className="space-y-2.5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    This course includes
                  </p>
                  {[
                    [PlayCircle, `${totalLessons} lessons`],
                    [Clock, formatDuration(course.durationHours * 60)],
                    [FileText, 'Downloadable resources'],
                    [Award, 'Certificate of completion'],
                    [Globe, 'Lifetime access'],
                  ].map(([Icon, label]) => {
                    const I = Icon as typeof PlayCircle;
                    return (
                      <div key={label as string} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <I className="h-4 w-4 text-primary" />
                        {label as string}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Course curriculum</h2>
          <p className="text-sm text-muted-foreground">
            {course.modules.length} modules &middot; {totalLessons} lessons
          </p>
        </div>

        <Accordion type="multiple" defaultValue={[course.modules[0]?.id]} className="space-y-3">
          {course.modules.map((module, mIdx) => {
            const moduleLessons = module.lessons;
            const moduleCompleted = moduleLessons.filter((l) => isCompleted(l.id)).length;
            return (
              <AccordionItem
                key={module.id}
                value={module.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <AccordionTrigger className="hover:no-underline px-5 py-4 [&[data-state=open]>div>svg.chevron]:rotate-90">
                  <div className="flex flex-1 items-center gap-3 pr-4">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {mIdx + 1}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium text-foreground">{module.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {moduleLessons.length} lessons &middot; {moduleCompleted} completed
                      </p>
                    </div>
                    <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <ul className="divide-y divide-border border-t border-border">
                    {moduleLessons.map((lesson) => {
                      const LIcon = lessonTypeIcon[lesson.type];
                      const done = isCompleted(lesson.id);
                      const quizQuestions = lesson.quizQuestions ?? [];
                      const lessonType = String(lesson.type).toLowerCase();
                      const isQuiz = lessonType === 'quiz' || quizQuestions.length > 0;
                      const isAssignment = lessonType === 'assignment';
                      return (
                        <li key={lesson.id}>
                          <Link
                            to={`/student/courses/${course.slug}/learn?lesson=${lesson.id}`}
                            className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                          >
                            {done ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                            ) : (
                              <Circle className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                            )}
                            <LIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate text-sm', done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>
                                {lesson.title}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDuration(lesson.durationMinutes)}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                          {canAccessMaterials && (lesson.videoUrl || lesson.pdfUrl) && (
                            <div className="flex items-center gap-2 px-5 pb-3">
                              {lesson.videoUrl && (
                                <a href={lesson.videoUrl} download className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                  <Download className="h-3.5 w-3.5" /> Video
                                </a>
                              )}
                              {lesson.pdfUrl && (
                                <a href={lesson.pdfUrl} download className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                  <Download className="h-3.5 w-3.5" /> Material
                                </a>
                              )}
                            </div>
                          )}
                          {isQuiz && (
                            <div className="mx-5 mb-3 rounded-lg border border-info/20 bg-info/5 p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>

                                  <p className="text-xs font-semibold uppercase tracking-wider text-info">Quiz</p>
                                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                                    <span><strong className="text-foreground">{lesson.quizQuestionCount ?? quizQuestions.length}</strong> questions</span>
                                    <span><strong className="text-foreground">{lesson.quizTotalMarks ?? quizQuestions.length}</strong> marks</span>
                                    <span><strong className="text-foreground">{lesson.timeLimitMinutes ?? 10}</strong> min</span>
                                  </div>
                                </div>
                                <Button size="sm" className="shrink-0" asChild>
                                  <Link to={`/student/courses/${course.slug}/quiz/${lesson.id}`}>
                                    <PlayCircle className="mr-2 h-4 w-4" /> Take Quiz
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          )}
                          {isAssignment && (lesson.assignmentTitle || lesson.assignmentDescription || lesson.assignmentPoints) && (
                            <div className="mx-5 mb-3 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Assignment
                                </p>
                                {lesson.assignmentPoints && (
                                  <Badge variant="outline">{lesson.assignmentPoints} points</Badge>
                                )}
                              </div>
                              {lesson.assignmentTitle && (
                                <p className="text-sm font-semibold text-foreground">{lesson.assignmentTitle}</p>
                              )}
                              {lesson.assignmentDescription && (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                  {lesson.assignmentDescription}
                                </p>
                              )}
                              {/* Upload widget — only shown to enrolled students */}
                              {isEnrolled && !isInstructorPreview && (
                                <OverviewAssignmentUpload
                                  courseId={course.id}
                                  lessonId={lesson.id}
                                  initialSubmitted={lesson.assignmentSubmitted}
                                />
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>

      {isEnrolled && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Give feedback</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your feedback is available to this course's instructor and the platform admin.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <Label>How would you rate this course?</Label>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setFeedbackRating(star)}
                      aria-label={`Rate ${star} out of 5`}
                    >
                      <Star className={cn('h-5 w-5', star <= feedbackRating ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="course-feedback">Your feedback</Label>
                <Textarea
                  id="course-feedback"
                  className="mt-2 min-h-28"
                  value={feedbackMessage}
                  onChange={(event) => setFeedbackMessage(event.target.value)}
                  placeholder="Tell us what was helpful or what could be improved..."
                />
              </div>
              <Button onClick={submitFeedback} disabled={submittingFeedback}>
                {submittingFeedback ? 'Submitting…' : 'Submit feedback'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discussions — visible to enrolled students and instructors previewing their own course */}
      {(isEnrolled || isInstructorOwner) && course.id && (
        <DiscussionsSection
          courseId={course.id}
          isEnrolled={isEnrolled && !isInstructorPreview}
          discussions={discussions}
          setDiscussions={setDiscussions}
        />
      )}

      {/* What you'll master */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground">What you will master</h3>
            <ul className="mt-4 space-y-2.5">
              {course.tags.map((tag) => (
                <li key={tag} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  {tag} fundamentals and advanced patterns
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                Building and debugging real models
              </li>
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                AI-coached practice and interview prep
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground">Prerequisites</h3>
            <ul className="mt-4 space-y-2.5">
              {[
                'Basic Python programming',
                'Familiarity with NumPy arrays',
                'High school linear algebra',
              ].map((req) => (
                <li key={req} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="h-[75vh] max-w-xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Course chat and support</DialogTitle>
            <DialogDescription>Message your instructor about this course.</DialogDescription>
          </DialogHeader>
          <CourseMessaging courseId={course.id} instructorName={course.instructor.name} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverviewAssignmentUpload
// A compact inline upload widget rendered directly on the course detail page
// so enrolled students can submit assignments without entering the player.
// ---------------------------------------------------------------------------
function OverviewAssignmentUpload({
  courseId,
  lessonId,
  initialSubmitted,
}: {
  courseId: string;
  lessonId: string;
  initialSubmitted?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initialSubmitted ?? false);
  const [submittedFileName, setSubmittedFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && !picked.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted.');
      e.target.value = '';
      return;
    }
    if (picked && picked.size > 10 * 1024 * 1024) {
      toast.error('File must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }
    setFile(picked);
  };

  const handleSubmit = async () => {
    if (!file) { toast.error('Choose your PDF file first.'); return; }
    setSubmitting(true);
    try {
      const { submitAssignment } = await import('@/lib/student-api');
      await submitAssignment(courseId, lessonId, file);
      setSubmitted(true);
      setSubmittedFileName(file.name);
      setFile(null);
      toast.success('Assignment submitted!', {
        description: 'Your instructor will be able to review your work.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-4">
      {submitted ? (
        /* Submitted state */
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Submitted{submittedFileName ? ` — ${submittedFileName}` : ''}</span>
          </div>
          {/* Allow resubmission */}
          <div className="flex items-center gap-2">
            <label
              htmlFor={`resubmit-${lessonId}`}
              className="cursor-pointer text-xs text-primary underline underline-offset-2"
            >
              {file ? file.name : 'Upload new version'}
              <input
                id={`resubmit-${lessonId}`}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {file && (
              <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {submitting ? 'Uploading…' : 'Resubmit'}
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Fresh submission */
        <div className="flex flex-wrap items-center gap-3">
          <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
          <label
            htmlFor={`upload-${lessonId}`}
            className="flex-1 cursor-pointer truncate text-sm text-muted-foreground hover:text-foreground"
          >
            {file ? (
              <span className="font-medium text-foreground">{file.name}</span>
            ) : (
              'Choose PDF file… (max 10 MB)'
            )}
            <input
              id={`upload-${lessonId}`}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => void handleSubmit()}
            disabled={!file || submitting}
          >
            {submitting
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {submitting ? 'Uploading…' : 'Submit'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiscussionsSection
// Renders the full discussion board for one course on the detail page.
// Enrolled students can open new threads and reply to existing ones.
// Instructors previewing their own course see threads read-only.
// ---------------------------------------------------------------------------
function DiscussionsSection({
  courseId,
  isEnrolled,
  discussions,
  setDiscussions,
}: {
  courseId: string;
  isEnrolled: boolean;
  discussions: import('@/lib/student-api').Discussion[];
  setDiscussions: React.Dispatch<React.SetStateAction<import('@/lib/student-api').Discussion[]>>;
}) {
  const [loadingList, setLoadingList] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Load threads once on mount
  useEffect(() => {
    let cancelled = false;
    import('@/lib/student-api')
      .then(({ listCourseDiscussions }) => listCourseDiscussions(courseId))
      .then((data) => { if (!cancelled) setDiscussions(data); })
      .catch(() => { /* not enrolled or offline — skip silently */ })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Title and content are both required.');
      return;
    }
    setPosting(true);
    try {
      const { postDiscussion } = await import('@/lib/student-api');
      const created = await postDiscussion(courseId, newTitle.trim(), newContent.trim());
      setDiscussions((prev) => [created, ...prev]);
      setNewTitle('');
      setNewContent('');
      setShowNewForm(false);
      toast.success('Discussion posted!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post discussion.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <MessageCircle className="h-5 w-5 text-primary" />
          Discussions
          {discussions.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({discussions.length})
            </span>
          )}
        </h2>
        {isEnrolled && (
          <Button
            size="sm"
            variant={showNewForm ? 'secondary' : 'default'}
            onClick={() => setShowNewForm((v) => !v)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {showNewForm ? 'Cancel' : 'New Discussion'}
          </Button>
        )}
      </div>

      {/* New-thread form */}
      {showNewForm && isEnrolled && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={(e) => void handlePost(e)} className="space-y-3">
              <div>
                <Label htmlFor="disc-title" className="text-xs font-semibold">
                  Title
                </Label>
                <input
                  id="disc-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Summarise your question…"
                  required
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <Label htmlFor="disc-content" className="text-xs font-semibold">
                  Details
                </Label>
                <Textarea
                  id="disc-content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Describe your question in detail…"
                  required
                  className="mt-1.5 min-h-24"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={posting}>
                  {posting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {posting ? 'Posting…' : 'Post Discussion'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Thread list */}
      {loadingList ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading discussions…</p>
      ) : discussions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No discussions yet</p>
            {isEnrolled && (
              <p className="text-xs text-muted-foreground">
                Be the first to ask a question or start a conversation.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <DiscussionThread
              key={d.id}
              discussion={d}
              courseId={courseId}
              isEnrolled={isEnrolled}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DiscussionThread
// A single collapsible thread card with inline reply capability.
// ---------------------------------------------------------------------------
function DiscussionThread({
  discussion,
  courseId: _courseId,
  isEnrolled,
}: {
  discussion: import('@/lib/student-api').Discussion;
  courseId: string;
  isEnrolled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<import('@/lib/student-api').DiscussionReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const toggleOpen = async () => {
    if (!open && replies.length === 0) {
      setLoadingReplies(true);
      try {
        const { getDiscussionReplies } = await import('@/lib/student-api');
        const data = await getDiscussionReplies(discussion.id);
        setReplies(data);
      } catch {
        toast.error('Could not load replies.');
      } finally {
        setLoadingReplies(false);
      }
    }
    setOpen((v) => !v);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { postDiscussionReply } = await import('@/lib/student-api');
      const reply = await postDiscussionReply(discussion.id, replyText.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyText('');
      toast.success('Reply posted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post reply.');
    } finally {
      setSending(false);
    }
  };

  const statusColors: Record<string, string> = {
    needs_answer: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    answered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };

  return (
    <Card className="overflow-hidden">
      {/* Thread header — click to expand */}
      <button
        type="button"
        onClick={() => void toggleOpen()}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/40"
        aria-expanded={open}
      >
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{discussion.title}</p>
            <Badge
              variant="outline"
              className={cn('shrink-0 text-[10px]', statusColors[discussion.status] ?? '')}
            >
              {discussion.status === 'needs_answer' ? 'Needs answer' : 'Answered'}
            </Badge>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {discussion.student?.name ?? 'Anonymous'} ·{' '}
            {new Date(discussion.created_at).toLocaleDateString()} ·{' '}
            {discussion.reply_count} {discussion.reply_count === 1 ? 'reply' : 'replies'}
          </p>
        </div>
        <ChevronRight
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Original post */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {discussion.content}
          </p>

          {/* Replies */}
          {loadingReplies ? (
            <p className="text-xs text-muted-foreground">Loading replies…</p>
          ) : replies.length > 0 ? (
            <div className="space-y-3 border-l-2 border-border pl-4">
              {replies.map((reply) => (
                <div key={reply.id} className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{reply.user?.name ?? 'Anonymous'}</span>
                    {reply.user?.role === 'instructor' && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        Instructor
                      </Badge>
                    )}
                    <span>·</span>
                    <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No replies yet.</p>
          )}

          {/* Reply form — enrolled students only */}
          {isEnrolled && (
            <form onSubmit={(e) => void handleReply(e)} className="flex items-end gap-2 pt-1">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 resize-none text-sm"
              />
              <Button type="submit" size="sm" disabled={!replyText.trim() || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
