import { useEffect, useState } from 'react';
import { MessageSquare, Star, ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { apiRequest } from '@/lib/api';

interface FeedbackItem {
  id: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  rating: number;
  message: string;
  createdAt: string;
}

interface CourseRow {
  id: string;
  title: string;
  feedbackCount: number;
  avgRating: number;
}

export function CourseFeedbackPage() {
  const { user } = useAuth();

  // ── Level 1: course grid ──────────────────────────────────────────────────
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // ── Level 2: feedback list for a selected course ──────────────────────────
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Load all feedback once so we can build the course grid from it.
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'instructor') return;
    setLoadingCourses(true);

    apiRequest('/course-feedback')
      .then((data: { feedback?: Array<{ id: number; course_id: string; course_title: string; rating: number; message: string; created_at: string; student_name: string }> }) => {
        const raw = data.feedback ?? [];

        // Aggregate per course
        const map = new Map<string, { title: string; count: number; ratingSum: number }>();
        for (const item of raw) {
          if (!map.has(item.course_id)) {
            map.set(item.course_id, { title: item.course_title, count: 0, ratingSum: 0 });
          }
          const entry = map.get(item.course_id)!;
          entry.count++;
          entry.ratingSum += item.rating;
        }

        setCourses(
          Array.from(map.entries()).map(([id, entry]) => ({
            id,
            title: entry.title,
            feedbackCount: entry.count,
            avgRating: Math.round((entry.ratingSum / entry.count) * 10) / 10,
          }))
        );
      })
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, [user?.role]);

  // Load feedback for a specific course when the instructor clicks on it.
  const openCourse = (course: CourseRow) => {
    setSelectedCourse(course);
    setLoadingFeedback(true);

    apiRequest(`/course-feedback?course_id=${encodeURIComponent(course.id)}`)
      .then((data: { feedback?: Array<{ id: number; course_id: string; course_title: string; rating: number; message: string; created_at: string; student_name: string }> }) => {
        setFeedback(
          (data.feedback ?? []).map((item) => ({
            id: String(item.id),
            courseId: item.course_id,
            courseTitle: item.course_title,
            studentName: item.student_name,
            rating: item.rating,
            message: item.message,
            createdAt: item.created_at,
          }))
        );
      })
      .catch(() => setFeedback([]))
      .finally(() => setLoadingFeedback(false));
  };

  const back = () => {
    setSelectedCourse(null);
    setFeedback([]);
  };

  // ── Level 2 view: feedback list for the selected course ───────────────────
  if (selectedCourse) {
    return (
      <div className="space-y-6 animate-in-slide">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={back} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            All courses
          </Button>
        </div>

        <PageHeader
          title={selectedCourse.title}
          description="Student feedback for this course"
        />

        {loadingFeedback ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading feedback…</p>
        ) : feedback.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <h2 className="font-semibold text-foreground">No feedback yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Students haven't submitted feedback for this course yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedback.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {item.studentName}
                    </p>
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      {item.rating}/5
                    </Badge>
                  </div>
                  <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                    {item.message}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Level 1 view: course grid ─────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Course Feedback"
        description={
          user?.role === 'admin'
            ? 'Review feedback submitted by students across all courses.'
            : 'Select a course to review its student feedback.'
        }
      />

      {loadingCourses ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading courses…</p>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h2 className="font-semibold text-foreground">No feedback yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Student feedback will appear here after it is submitted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => openCourse(course)}
              className="group rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary flex flex-col justify-between"
            >
              {/* Header row: icon + rating pill */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning">
                    <Star className="h-3.5 w-3.5 fill-warning" />
                    {course.avgRating.toFixed(1)}
                  </div>
                </div>

                <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">
                  {course.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {course.feedbackCount}{' '}
                  {course.feedbackCount === 1 ? 'review' : 'reviews'}
                </p>
              </div>

              {/* Footer link */}
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm font-medium text-primary">
                <span>View student feedback</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
