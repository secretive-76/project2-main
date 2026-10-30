import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Search, Filter, Award, MessageSquare, BookOpen, User, RefreshCcw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiRequest, resolveBackendAssetUrl } from '@/lib/api';
import { ChevronRight, /* other icons you are using */ } from 'lucide-react';

interface Submission {
  id: string;
  studentId: number;
  courseId: string;
  lessonId: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  moduleTitle: string;
  assignmentTitle: string;
  submittedAt: string;
  status: 'pending' | 'graded';
  score?: number;
  maxScore: number;
  feedback?: string;
  fileUrl?: string;
}

interface GradingLesson { id: string; title: string; }
interface GradingModule { id: string; title: string; lessons: GradingLesson[]; }
interface GradingCourse { id: string; title: string; modules: GradingModule[]; }

export function InstructorGradingPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [courses, setCourses] = useState<GradingCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');

  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const assignmentLessons = selectedCourse?.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title }))) ?? [];
  const selectedLesson = assignmentLessons.find((lesson) => lesson.id === selectedLessonId);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/instructor/grading/courses') as { courses?: GradingCourse[] };
      const nextCourses = data.courses ?? [];
      setCourses(nextCourses);
      setSelectedCourseId('');
      setSelectedLessonId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load grading courses.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (courseId: string, lessonId: string) => {
    if (!courseId || !lessonId) { setSubmissions([]); return; }
    setLoading(true);
    try {
      const data = await apiRequest(`/instructor/grading/roster?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lessonId)}`) as {
        students?: Array<{ student_id: number; student_name: string; student_email: string; submission_id: number | null; file_name: string | null; storage_path: string | null; submitted_at: string | null; score: number | null; feedback: string | null; graded_status: string; has_submitted: boolean }>;
      };
      setSubmissions((data.students ?? []).map((s) => ({
        id: s.submission_id === null ? `student-${s.student_id}` : String(s.submission_id),
        studentId: s.student_id,
        courseId,
        lessonId,
        studentName: s.student_name,
        studentEmail: s.student_email,
        courseTitle: selectedCourse?.title ?? '—',
        moduleTitle: selectedLesson?.moduleTitle ?? '',
        assignmentTitle: selectedLesson?.title ?? '—',
        submittedAt: s.submitted_at ?? '',
        status: s.graded_status === 'graded' ? 'graded' : 'pending',
        score: s.score ?? undefined,
        feedback: s.feedback || undefined,
        maxScore: 100,
        fileUrl: s.storage_path ? resolveBackendAssetUrl(s.storage_path) : undefined,
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load assignment roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCourses();
  }, []);

  useEffect(() => {
    void fetchSubmissions(selectedCourseId, selectedLessonId);
  }, [selectedCourseId, selectedLessonId]);

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.moduleTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenGradeDialog = (sub: Submission) => {
    setSelectedSubmission(sub);
    setScoreInput(sub.score !== undefined ? sub.score.toString() : '');
    setFeedbackInput(sub.feedback || '');
    setIsDialogOpen(true);
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission) return;
    const scoreNum = Number(scoreInput);

    if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > selectedSubmission.maxScore) {
      toast.error(`Score must be between 0 and ${selectedSubmission.maxScore}.`);
      return;
    }

    try {
      await apiRequest('/instructor/grade', {
        method: 'POST',
        body: JSON.stringify({
          student_id: selectedSubmission.studentId,
          course_id: selectedSubmission.courseId,
          lesson_id: selectedSubmission.lessonId,
          score: scoreNum,
          feedback: feedbackInput.trim(),
        }),
      });

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === selectedSubmission.id
            ? { ...item, status: 'graded', score: scoreNum, feedback: feedbackInput.trim() }
            : item
        )
      );
      toast.success(`Grade saved for ${selectedSubmission.studentName}.`);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save grade.');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grading & Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Review student assignments, grade lab notebooks, and provide personalized feedback.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => selectedCourseId ? void fetchSubmissions(selectedCourseId, selectedLessonId) : void fetchCourses()} disabled={loading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      {!selectedCourseId ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <Card className="flex items-center justify-center p-10 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-muted-foreground">Loading courses…</p>
            </Card>
          ) : courses.length === 0 ? (
            <Card className="flex items-center justify-center p-10 text-center sm:col-span-2 lg:col-span-3">
              <p className="text-sm text-muted-foreground">No courses are assigned to you.</p>
            </Card>
          ) : courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => {
                setSelectedCourseId(course.id);
                setSelectedLessonId(course.modules[0]?.lessons[0]?.id ?? '');
              }}
              className="rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <BookOpen className="mb-3 h-5 w-5 text-primary" />
                  <h2 className="font-semibold">{course.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {course.modules.length} module{course.modules.length === 1 ? '' : 's'} · {course.modules.reduce((count, module) => count + module.lessons.length, 0)} assignment{course.modules.reduce((count, module) => count + module.lessons.length, 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedCourseId(''); setSelectedLessonId(''); setSubmissions([]); }}>
                ← All courses
              </Button>
              <h2 className="mt-2 text-xl font-semibold">{selectedCourse?.title}</h2>
            </div>
            <label className="space-y-1.5 text-sm font-medium">
              Assignment
              <select
                value={selectedLessonId}
                onChange={(event) => setSelectedLessonId(event.target.value)}
                className="flex h-10 min-w-64 rounded-md border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="">Select an assignment</option>
                {assignmentLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.moduleTitle} › {lesson.title}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search student, assignment, or course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All Submissions</TabsTrigger>
            <TabsTrigger value="pending">
              Pending{' '}
              <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px]">
                {submissions.filter((s) => s.status === 'pending').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="graded">Graded</TabsTrigger>
          </TabsList>
        </Tabs>
          </div>
        </>
      )}
      {selectedCourseId && (
      <div className="grid gap-4">
        {loading ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <RefreshCcw className="h-10 w-10 text-muted-foreground/50 mb-3 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading submissions…</p>
          </Card>
        ) : filteredSubmissions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-semibold">No submissions found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {submissions.length === 0
                ? 'No students have submitted assignments yet.'
                : 'Try adjusting your search filters.'}
            </p>
          </Card>
        ) : (
          filteredSubmissions.map((sub) => (
            <Card key={sub.id} className="transition-all hover:border-indigo/50">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{sub.studentName}</span>
                    <span className="text-xs text-muted-foreground">({sub.studentEmail})</span>
                    {sub.status === 'pending' ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                        <Clock className="h-3 w-3" /> Pending Review
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Graded ({sub.score}/{sub.maxScore})
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground">{sub.courseTitle}</span>
                    {sub.moduleTitle && (
                      <>
                        <span className="text-muted-foreground/50">›</span>
                        <span>{sub.moduleTitle}</span>
                      </>
                    )}
                    <span className="text-muted-foreground/50">›</span>
                    <span className="font-medium text-foreground">{sub.assignmentTitle}</span>
                    <span className="text-muted-foreground/50"> · </span>
                    <span>Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {sub.fileUrl && (
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View PDF
                    </a>
                  )}
                  <Button variant={sub.status === 'pending' ? 'default' : 'outline'} onClick={() => handleOpenGradeDialog(sub)}>
                    {sub.status === 'pending' ? 'Grade Assignment' : 'Edit Grade'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}

      {/* Grade Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Reviewing assignment for <span className="font-semibold text-foreground">{selectedSubmission?.studentName}</span> ({selectedSubmission?.assignmentTitle})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="score">Score (Out of {selectedSubmission?.maxScore})</Label>
              <Input
                id="score"
                type="number"
                placeholder="e.g. 85"
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback for Student</Label>
              <Textarea
                id="feedback"
                placeholder="Write constructive notes or guidance..."
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveGrade()}>Save & Publish Grade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}