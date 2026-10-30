import { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  PlayCircle,
  Video as VideoIcon,
  FileText,
  ListChecks,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  StickyNote,
  PanelRightClose,
  PanelRightOpen,
  X,
  Menu,
  ExternalLink,
  Check,
  Loader2,
  Lock,
  ClipboardCheck,
  Upload,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { VideoPlayer } from '@/components/player/video-player';
import { PdfViewer } from '@/components/player/pdf-viewer';
import { NotesPanel } from '@/components/player/notes-panel';
import { CourseMessaging } from '@/components/player/course-messaging';
import { getCourseBySlug, getAllLessons, getLessonById, isLessonUnlocked } from '@/lib/course-utils';
import { useLessonProgress } from '@/hooks/use-lesson-progress';
import { enrollStudent } from '@/lib/student-api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Course, Lesson } from '@/types';
import { apiRequest, resolveBackendAssetUrl } from '@/lib/api';

const lessonTypeIcon: Record<string, typeof VideoIcon> = {
  video: VideoIcon,
  reading: FileText,
  quiz: ListChecks,
  assignment: ClipboardCheck,
  'ai-coaching': MessageSquare,
};

const lessonTypeLabel: Record<string, string> = {
  video: 'Video',
  reading: 'Reading',
  quiz: 'Quiz',
  assignment: 'Assignment',
  'ai-coaching': 'AI Coaching',
};

type PanelTab = 'notes' | 'messages';

export function CoursePlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [course, setCourse] = useState<Course | undefined>(() => (slug ? getCourseBySlug(slug) : undefined));
  const [courseLoading, setCourseLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setCourseLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    setCourseLoading(true);
    // Load the course first. Submission history is supplementary and must not
    // keep the video, quiz, or assignment page on a permanent loading screen.
    void apiRequest(`/courses/${encodeURIComponent(slug)}`, { signal: controller.signal }).then((data) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        const mapped: Course = {
          id: data.id,
          slug: data.slug || data.id,
          title: data.title,
          subtitle: data.description || 'Live course from the Akademia platform',
          description: data.description || 'No description provided.',
          category: data.category || 'General',
          difficulty: data.difficulty || 'Beginner',
          thumbnailUrl: resolveBackendAssetUrl(data.thumbnail_url),
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
              durationMinutes: lesson.duration_minutes || lesson.duration || 0,
              type: String(lesson.lesson_type || lesson.type || (lesson.assignment_title || lesson.assignmentTitle ? 'assignment' : 'video')).toLowerCase(),
              completed: lesson.completed || false,
              description: lesson.description || undefined,
              videoUrl: resolveBackendAssetUrl(lesson.video_path || lesson.video_url || lesson.videoUrl),
              pdfUrl: resolveBackendAssetUrl(lesson.resource_path || lesson.pdf_url || lesson.pdfUrl),
              readingContent: lesson.content || undefined,
              assignmentTitle: lesson.assignment_title || lesson.assignmentTitle || undefined,
              assignmentDescription: lesson.assignment_instructions || lesson.assignment_description || lesson.assignmentDescription || undefined,
              assignmentPoints: lesson.assignment_points || lesson.assignmentPoints || 10,
              // Mark true when we have a submission row for this lesson
              assignmentSubmitted: false,
              // Quiz preview metadata — used by course-detail accordion to show question count.
              // correct_choice is intentionally absent from the public API response.
              quizQuestions: Array.isArray(lesson.quiz_questions)
                ? lesson.quiz_questions.map((q: { question: string; choices: string[] }) => ({
                    question: q.question || '',
                    choices: Array.isArray(q.choices) ? q.choices : [],
                  }))
                : [],
              quizQuestionCount: lesson.quiz_question_count
                ?? (Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions.length : 0),
              quizTotalMarks: lesson.quiz_total_marks
                ?? (Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions.length : 0),
              resources: [
                // PDF / resource file uploaded for this lesson
                ...(lesson.resource_path || lesson.resource_url
                  ? [{ label: lesson.title + ' — Material (PDF)', url: resolveBackendAssetUrl(lesson.resource_path || lesson.resource_url) }]
                  : []),
                // Video file — offered as a download when present
                ...(lesson.video_path || lesson.video_url
                  ? [{ label: lesson.title + ' — Video', url: resolveBackendAssetUrl(lesson.video_path || lesson.video_url) }]
                  : []),
              ],
            })),
          })),
          status: 'not-started',
          progress: 0,
        };
        setCourse(mapped);
        setCourseLoading(false);

        // Hydrate submission badges afterwards. A slow submission query never
        // blocks access to the course itself.
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
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        const fallback = getCourseBySlug(slug);
        if (fallback) setCourse(fallback);
        setCourseLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [slug]);

  useEffect(() => {
    if (course) {
      // Visiting the player from an enrolled course keeps its enrollment in the
      // database. The course detail page handles the explicit Enroll button.
      enrollStudent(course.id).catch(() => undefined);
    }
  }, [course?.id]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>('notes');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { completedLessons, isCompleted, markComplete, loading: progressLoading } = useLessonProgress(course?.id ?? '');

  const allLessons = useMemo(() => (course ? getAllLessons(course) : []), [course]);

  const currentLessonId = searchParams.get('lesson') ?? allLessons[0]?.id;
  const currentLessonData = course && currentLessonId ? getLessonById(course, currentLessonId) : undefined;
  const currentLesson = currentLessonData?.lesson;
  const currentModule = currentLessonData?.module;

  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : undefined;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : undefined;

  const completedCount = allLessons.filter((l) => isCompleted(l.id)).length;
  const progressPct = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  const isCurrentUnlocked = course && currentLesson
    ? isLessonUnlocked(allLessons, currentLesson.id, completedLessons)
    : false;

  useEffect(() => {
    if (!currentLessonId && allLessons[0]) {
      setSearchParams({ lesson: allLessons[0].id }, { replace: true });
    }
  }, [currentLessonId, allLessons, setSearchParams]);

  if (courseLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading course…</div>;
  }

  if (!course) {
    return <Navigate to="/student/browse" replace />;
  }

  if (!currentLesson) {
    return <Navigate to={`/student/courses/${course.slug}`} replace />;
  }

  const navigateToLesson = (lessonId: string) => {
    setSearchParams({ lesson: lessonId });
    setMobileMenuOpen(false);
  };

  const completeCurrentLesson = () => {
    markComplete(currentLesson.id, completedCount + (lessonDone ? 0 : 1) === allLessons.length, currentLesson.durationMinutes);
    toast.success('Lesson completed', {
      description: nextLesson ? 'Moving to the next lesson.' : 'You finished the course!',
    });
    if (nextLesson) {
      setTimeout(() => navigateToLesson(nextLesson.id), 600);
    }
  };

  const handleComplete = () => {
    if (isAssignmentLesson && !currentLesson.assignmentSubmitted) {
      toast.error('Submit your PDF before completing this assignment.');
      return;
    }
    completeCurrentLesson();
  };

  const goToNext = () => {
    if (nextLesson) navigateToLesson(nextLesson.id);
  };

  const goToPrev = () => {
    if (prevLesson) navigateToLesson(prevLesson.id);
  };

  const normalizedCurrentType = String(currentLesson.type || 'video').toLowerCase();
  const isAssignmentLesson = normalizedCurrentType === 'assignment' || Boolean(
    currentLesson.assignmentTitle || currentLesson.assignmentDescription || currentLesson.assignmentPoints,
  );
  // A legacy completion without a submission is not a real assignment completion.
  const lessonDone = isCompleted(currentLesson.id) && (!isAssignmentLesson || Boolean(currentLesson.assignmentSubmitted));
  // PDFs are embedded in the lesson itself. Keep other files in the material list.
  const isPdfDocument = /\.pdf(?:$|\?)/i.test(currentLesson.pdfUrl ?? '');
  const nonPdfResources = (currentLesson.resources ?? []).filter((resource) => !/\.pdf(?:$|\?)/i.test(resource.url));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open lessons">
          <Menu className="h-5 w-5" />
        </Button>
        <Link to={`/student/courses/${course.slug}`} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{course.title}</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <Progress value={progressPct} className="h-1.5 w-28" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPanelOpen((v) => !v)}
            aria-label={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Lesson sidebar — desktop */}
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
          <LessonSidebar
            course={course}
            allLessons={allLessons}
            currentLessonId={currentLessonId}
            isCompleted={isCompleted}
            isUnlocked={(id) => isLessonUnlocked(allLessons, id, completedLessons)}
            onNavigate={navigateToLesson}
            progressPct={progressPct}
            completedCount={completedCount}
            totalCount={allLessons.length}
          />
        </aside>

        {/* Lesson sidebar — mobile drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-semibold">Lessons</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <LessonSidebar
                course={course}
                allLessons={allLessons}
                currentLessonId={currentLessonId}
                isCompleted={isCompleted}
                isUnlocked={(id) => isLessonUnlocked(allLessons, id, completedLessons)}
                onNavigate={navigateToLesson}
                progressPct={progressPct}
                completedCount={completedCount}
                totalCount={allLessons.length}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl p-4 lg:p-6">
              {!isCurrentUnlocked && currentIndex > 0 ? (
                <LockedLessonNotice prevLessonTitle={prevLesson?.title ?? 'the previous lesson'} />
              ) : (
                <>
                  {/* Lesson header */}
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          {(() => {
                            const I = lessonTypeIcon[normalizedCurrentType] || VideoIcon;
                            return <I className="h-3 w-3" />;
                          })()}
                          {lessonTypeLabel[normalizedCurrentType] || 'Lesson'}
                        </Badge>
                        {currentModule && (
                          <span className="text-xs text-muted-foreground">{currentModule.title}</span>
                        )}
                      </div>
                      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {currentLesson.title}
                      </h1>
                      {currentLesson.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{currentLesson.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDuration(currentLesson.durationMinutes)}</span>
                    </div>
                  </div>

                  {/* Content area */}
                  <div className="mb-6">
                    {normalizedCurrentType === 'video' && currentLesson.videoUrl ? (
                      <VideoPlayer src={currentLesson.videoUrl} onEnded={handleComplete} onNext={nextLesson ? goToNext : undefined} />
                    ) : normalizedCurrentType === 'reading' && currentLesson.readingContent ? (
                      <ReadingContent content={currentLesson.readingContent} />
                    ) : normalizedCurrentType === 'reading' && currentLesson.pdfUrl && isPdfDocument ? (
                      <PdfViewer
                        url={currentLesson.pdfUrl}
                        fileName={`${currentLesson.title}.pdf`}
                        onReachLastPage={() => { if (!lessonDone) completeCurrentLesson(); }}
                      />
                    ) : normalizedCurrentType === 'video' && currentLesson.pdfUrl && isPdfDocument ? (
                      <PdfViewer
                        url={currentLesson.pdfUrl}
                        fileName={`${currentLesson.title}.pdf`}
                        onReachLastPage={() => { if (!lessonDone) completeCurrentLesson(); }}
                      />
                    ) : (normalizedCurrentType === 'reading' || normalizedCurrentType === 'video') && currentLesson.pdfUrl ? (
                      <UnsupportedDocumentNotice url={currentLesson.pdfUrl} title={currentLesson.title} />
                    ) : isAssignmentLesson ? (
                      <AssignmentContent courseId={course.id} lesson={currentLesson} onComplete={completeCurrentLesson} />
                    ) : normalizedCurrentType === 'quiz' ? (
                      <div className="rounded-xl border border-info/20 bg-info/5 p-6 text-center">
                        <ListChecks className="mx-auto h-10 w-10 text-info" />
                        <h3 className="mt-3 font-semibold text-foreground">Quiz lesson</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Open the dedicated quiz screen to begin.</p>
                        <Button className="mt-4" asChild>
                          <Link to={`/student/courses/${course.slug}/quiz/${currentLesson.id}`}>Take Quiz</Link>
                        </Button>
                      </div>
                    ) : normalizedCurrentType === 'ai-coaching' ? (
                      <AICoachingPlaceholder lessonTitle={currentLesson.title} />
                    ) : (
                      <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground">
                        <div className="text-center">
                          <PlayCircle className="mx-auto mb-2 h-10 w-10" />
                          <p className="text-sm">Content for this lesson is coming soon.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Non-PDF course materials. PDFs are displayed above in the reader. */}
                  {nonPdfResources.length > 0 && (
                    <div className="mb-6 rounded-xl border border-border bg-card p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        Course Materials
                      </h3>
                      <ul className="divide-y divide-border">
                        {nonPdfResources.map((r) => (
                          <li key={r.url} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                            <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{r.label}</span>
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View
                              </a>
                              <a
                                href={r.url}
                                download
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Nav + complete */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={goToPrev} disabled={!prevLesson}>
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNext}
                        disabled={!nextLesson || !lessonDone}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleComplete}
                      variant={lessonDone ? 'secondary' : 'default'}
                      size="sm"
                      disabled={progressLoading || (isAssignmentLesson && !currentLesson.assignmentSubmitted && !lessonDone)}
                    >
                      {progressLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : lessonDone ? (
                        <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {lessonDone ? 'Completed' : 'Mark as complete'}
                    </Button>
                  </div>

                  {/* Next lesson locked indicator */}
                  {nextLesson && !lessonDone && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4 text-warning" />
                      <span>
                        Complete this lesson to unlock <strong className="text-foreground">{nextLesson.title}</strong>
                      </span>
                    </div>
                  )}

                  {/* Mobile panel toggle */}
                  {!panelOpen && (
                    <Button
                      variant="outline"
                      className="mt-4 w-full lg:hidden"
                      onClick={() => setPanelOpen(true)}
                    >
                      <StickyNote className="mr-2 h-4 w-4" />
                      Open notes & messages
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: Notes + Messages */}
        {panelOpen && (
          <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:flex lg:flex-col">
            <div className="flex border-b border-border">
              <button
                onClick={() => setPanelTab('notes')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
                  panelTab === 'notes'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <StickyNote className="h-4 w-4" />
                Notes
              </button>
              <button
                onClick={() => setPanelTab('messages')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors',
                  panelTab === 'messages'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Instructor
              </button>
            </div>
            {panelTab === 'notes' ? (
              <NotesPanel
                courseId={course.id}
                lessonId={currentLesson.id}
                lessonTitle={currentLesson.title}
                className="flex-1"
              />
            ) : (
              <CourseMessaging courseId={course.id} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function UnsupportedDocumentNotice({ url, title }: { url: string; title: string }) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
      <div>
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 font-semibold text-foreground">{title} is not a PDF document</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          PowerPoint files are not opened automatically. Upload a real PDF version to show it inside the lesson.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <a href={url} download><Download className="mr-2 h-4 w-4" />Download file</a>
        </Button>
      </div>
    </div>
  );
}

function LockedLessonNotice({ prevLessonTitle }: { prevLessonTitle: string }) {
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-warning/10">
        <Lock className="h-8 w-8 text-warning" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">This lesson is locked</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Complete <strong className="text-foreground">{prevLessonTitle}</strong> to unlock this lesson.
        You must follow the course sequence in order.
      </p>
    </div>
  );
}

function LessonSidebar({
  course,
  allLessons,
  currentLessonId,
  isCompleted,
  isUnlocked,
  onNavigate,
  progressPct,
  completedCount,
  totalCount,
}: {
  course: ReturnType<typeof getCourseBySlug>;
  allLessons: ReturnType<typeof getAllLessons>;
  currentLessonId: string;
  isCompleted: (id: string) => boolean;
  isUnlocked: (id: string) => boolean;
  onNavigate: (id: string) => void;
  progressPct: number;
  completedCount: number;
  totalCount: number;
}) {
  if (!course) return null;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <Link to={`/student/courses/${course.slug}`} className="mb-3 block">
          <Logo size="sm" />
        </Link>
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{course.title}</p>
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{completedCount} / {totalCount} lessons</span>
            <span className="font-medium text-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {course.modules.map((module, mIdx) => (
          <div key={module.id} className="mb-3">
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {mIdx + 1}. {module.title}
            </p>
            <ul className="space-y-0.5">
              {module.lessons.map((lesson) => {
                const normalizedType = String(lesson.type || 'video').toLowerCase();
                const LIcon = lessonTypeIcon[normalizedType] || VideoIcon;
                const done = isCompleted(lesson.id);
                const active = lesson.id === currentLessonId;
                const unlocked = isUnlocked(lesson.id);
                return (
                  <li key={lesson.id}>
                    <button
                      onClick={() => unlocked && onNavigate(lesson.id)}
                      disabled={!unlocked}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                        !unlocked && 'cursor-not-allowed opacity-50',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : unlocked
                            ? 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                            : 'text-muted-foreground/40'
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-success')} />
                      ) : !unlocked ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                      ) : active ? (
                        <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                      )}
                      <LIcon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="line-clamp-1 flex-1">{lesson.title}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {lesson.durationMinutes}m
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingContent({ content }: { content: string }) {
  const sections = content.split('\n## ').filter(Boolean);
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-border bg-card p-6 lg:p-8">
      {sections.map((section, i) => {
        const lines = section.split('\n');
        const title = i === 0 && !section.startsWith('## ') ? null : lines[0];
        const body = title ? lines.slice(1) : lines;
        return (
          <div key={i} className={i > 0 ? 'mt-6' : ''}>
            {title && <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>}
            <div className="space-y-2">
              {body.map((line, j) => {
                if (line.startsWith('### ')) {
                  return <h4 key={j} className="mt-3 text-sm font-semibold text-foreground">{line.slice(4)}</h4>;
                }
                if (line.startsWith('- ')) {
                  return (
                    <p key={j} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-primary">•</span>
                      <span>{line.slice(2)}</span>
                    </p>
                  );
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={j} className="text-sm font-semibold text-foreground">{line.slice(2, -2)}</p>;
                }
                if (line.trim()) {
                  return <p key={j} className="text-sm leading-relaxed text-muted-foreground">{line}</p>;
                }
                return null;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssignmentContent({
  courseId,
  lesson,
  onComplete,
}: {
  courseId: string;
  lesson: Lesson;
  onComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Initialise from the Lesson field so the state reflects what was hydrated
  // from the server before the component first mounts.
  const [submitted, setSubmitted] = useState(lesson.assignmentSubmitted ?? false);
  const [submittedFileName, setSubmittedFileName] = useState<string | null>(null);
  const referencePdf = lesson.pdfUrl ?? lesson.resources?.find((resource) => /\.pdf(?:$|\?)/i.test(resource.url))?.url;
  const nonPdfReferences = (lesson.resources ?? []).filter((resource) => !/\.pdf(?:$|\?)/i.test(resource.url));

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
    if (!file) {
      toast.error('Select your PDF file first.');
      return;
    }
    try {
      setUploading(true);
      const { submitAssignment } = await import('@/lib/student-api');
      await submitAssignment(courseId, lesson.id, file);
      setSubmitted(true);
      setSubmittedFileName(file.name);
      setFile(null);
      onComplete();
      toast.success('Assignment submitted!', {
        description: 'Your instructor will be able to review your work.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit assignment.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-6">
        {/* Header row */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {lesson.assignmentTitle ?? lesson.title}
            </h3>
          </div>
          {/* Points badge */}
          {lesson.assignmentPoints != null && lesson.assignmentPoints > 0 && (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              {lesson.assignmentPoints} pts
            </span>
          )}
        </div>

        {/* Instructions */}
        {lesson.assignmentDescription && (
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {lesson.assignmentDescription}
          </p>
        )}

        {/* Reading content (if any) */}
        {lesson.readingContent && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
            <ReadingContent content={lesson.readingContent} />
          </div>
        )}

        {/* The assignment document is shown directly in the page. Reading it does not submit the assignment. */}
        {referencePdf && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assignment document
            </p>
            <PdfViewer url={referencePdf} fileName={`${lesson.title}.pdf`} />
          </div>
        )}

        {nonPdfReferences.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other reference files
            </p>
            <ul className="space-y-1.5">
              {nonPdfReferences.map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submission area */}
        <div className="rounded-lg border-2 border-dashed border-border p-5">
          {submitted ? (
            /* Already submitted — show success + allow resubmit */
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-9 w-9 text-success" />
              <div>
                <p className="font-medium text-foreground">Assignment submitted</p>
                {submittedFileName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{submittedFileName}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Your instructor will review your work shortly.
                </p>
              </div>
              {/* Resubmit */}
              <div className="mt-2 flex flex-col items-center gap-2">
                <label className="cursor-pointer text-xs text-primary underline underline-offset-2">
                  Upload a new version
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {file && (
                  <div className="flex items-center gap-2">
                    <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {file.name}
                    </span>
                    <Button size="sm" onClick={() => void handleSubmit()} disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {uploading ? 'Uploading…' : 'Resubmit'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fresh upload */
            <div className="flex flex-col items-center gap-3 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Upload your PDF submission</p>
                <p className="mt-0.5 text-xs text-muted-foreground">PDF only · max 10 MB</p>
              </div>
              <label className="cursor-pointer">
                <span className="rounded-md border border-input bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent">
                  {file ? file.name : 'Choose file…'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <Button
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!file || uploading}
                className="min-w-[120px]"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Uploading…' : 'Submit Work'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineQuiz({ lesson, onComplete }: { lesson: Lesson; onComplete: () => void }) {
  const [questions, setQuestions] = useState<import('@/lib/student-api').StudentQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/student-api').then(({ loadStudentQuiz }) => loadStudentQuiz(lesson.id)).then((data) => {
      if (cancelled) return;
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => -1));
      setSecondsLeft(data.time_limit_seconds || (data.time_limit_minutes || 10) * 60);
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load quiz')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lesson.id]);

  useEffect(() => {
    if (loading || submitted || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading, submitted, secondsLeft]);

  const submit = async () => {
    if (!questions.length || answers.some((answer) => answer < 0)) { toast.error('Answer every question before submitting.'); return; }
    try {
      const { submitStudentQuiz } = await import('@/lib/student-api');
      const result = await submitStudentQuiz(lesson.id, answers);
      setSubmitted(true);
      toast.success(`Quiz submitted: ${result.score}% (${result.correct_answers}/${result.total_questions})`);
      if (result.score >= 80) onComplete();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not submit quiz.'); }
  };

  if (loading) return <div className="rounded-xl border border-info/20 bg-info/5 p-6">Loading quiz…</div>;
  if (!questions.length) return <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No quiz questions have been added yet.</div>;

  return (
    <div className="rounded-xl border border-info/20 bg-info/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-info/10">
          <ListChecks className="h-5 w-5 text-info" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{lesson.title}</h3>
          <p className="text-sm text-muted-foreground">{lesson.description ?? 'Test your understanding'}</p>
        </div>
      </div>
      <div className="mb-4 text-sm font-semibold text-warning">Time left: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</div>
      <div className="space-y-4">
        {questions.map((question, questionIndex) => <div key={question.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">{questionIndex + 1}. {question.question}</p>
          {question.choices.map((option, optionIndex) => <button key={option} type="button" onClick={() => !submitted && setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer))} className={cn('w-full rounded-lg border p-3 text-left text-sm transition-colors', answers[questionIndex] === optionIndex ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted')}>
            {String.fromCharCode(65 + optionIndex)}. {option}
          </button>)}
        </div>)}
        <Button onClick={() => void submit()} className="w-full" disabled={submitted || secondsLeft <= 0}>
          <Check className="mr-2 h-4 w-4" />
          Submit answer
        </Button>
      </div>
    </div>
  );
}

function AICoachingPlaceholder({ lessonTitle }: { lessonTitle: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-teal/30 bg-teal/5 p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/10">
        <Sparkles className="h-7 w-7 text-teal" />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">AI Coach is ready</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Ask questions about "{lessonTitle}" or paste your code for instant debugging help.
      </p>
      <Button className="mt-4" asChild>
        <Link to="/student/ai-coach">
          <Sparkles className="mr-2 h-4 w-4 text-teal" />
          Start coaching session
        </Link>
      </Button>
    </div>
  );
}
