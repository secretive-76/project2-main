import { useEffect, useState } from 'react';
import {
  BookOpen, Check, X, Trash2, Eye, RefreshCcw,
  Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getImageUrl } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AdminCourseItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  status: 'pending' | 'approved' | 'disapproved';
  admin_feedback?: string;
  instructor: string;
  updated_at: string;
}

const API_BASE = 'http://localhost:8081';

// ── Individual course card ─────────────────────────────────────────────────────

interface CourseCardProps {
  course: AdminCourseItem;
  feedback: string;
  onFeedbackChange: (val: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete: () => void;
  acting: boolean;
}

function CourseCard({
  course, feedback, onFeedbackChange,
  onApprove, onReject, onDelete, acting,
}: CourseCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-start">
        {/* Thumbnail */}
        <div className="h-36 overflow-hidden bg-muted md:h-full">
          {course.thumbnail_url ? (
            <img
              src={getImageUrl(course.thumbnail_url)}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2 p-4 md:p-4 md:pl-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{course.title}</h3>
            <Badge variant="secondary">{course.category}</Badge>
            <Badge variant="outline">{course.difficulty}</Badge>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.description || 'No description provided.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Instructor: <span className="font-medium text-foreground">{course.instructor || 'Unknown'}</span>
            {' · '}Updated {new Date(course.updated_at).toLocaleString()}
          </p>
          {course.admin_feedback && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Feedback given:</span> {course.admin_feedback}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-4 md:pr-4 md:pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/admin/courses/${course.slug || course.id}/preview`, '_blank')}
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>

          {/* Show feedback + approve/reject only when those actions are available */}
          {(onApprove || onReject) && (
            <>
              <Textarea
                value={feedback}
                onChange={e => onFeedbackChange(e.target.value)}
                placeholder="Optional feedback for the instructor"
                className="min-h-[72px] text-xs"
              />
              {onApprove && (
                <Button size="sm" disabled={acting} onClick={onApprove}
                  className="bg-emerald-500 text-white hover:bg-emerald-600">
                  <Check className="mr-2 h-4 w-4" /> Approve
                </Button>
              )}
              {onReject && (
                <Button size="sm" disabled={acting} variant="secondary" onClick={onReject}>
                  <X className="mr-2 h-4 w-4" /> Reject
                </Button>
              )}
            </>
          )}

          <Button variant="destructive" size="sm" disabled={acting} onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyTab({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load courses');
      setCourses(data.courses ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCourses(); }, []);

  // Update status — optimistically remove from current bucket, refetch to confirm
  const actOnCourse = async (courseId: string, status: 'approved' | 'disapproved') => {
    setActing(courseId);
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, admin_feedback: feedback[courseId] ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Action failed');

      // Optimistically update local state so the card moves tabs immediately
      setCourses(prev =>
        prev.map(c => c.id === courseId ? { ...c, status, admin_feedback: feedback[courseId] ?? c.admin_feedback } : c)
      );

      toast.success(
        status === 'approved'
          ? 'Course approved — it is now visible to students.'
          : 'Course rejected — the instructor has been notified.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
      void fetchCourses(); // re-sync on error
    } finally {
      setActing(null);
    }
  };

  const removeCourse = async (courseId: string) => {
    setActing(courseId);
    try {
      const token = localStorage.getItem('akademia-token');
      const res = await fetch(`${API_BASE}/api/admin/courses/${courseId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setCourses(prev => prev.filter(c => c.id !== courseId));
      toast.success('Course deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setActing(null);
    }
  };

  // Split courses by status
  const pending = courses.filter(c => c.status === 'pending');
  const approved = courses.filter(c => c.status === 'approved');
  const rejected = courses.filter(c => c.status === 'disapproved');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Moderation"
        description="Review instructor submissions. Approved courses appear to students; rejected courses are sent back to the instructor."
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchCourses()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading courses…
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="mb-4">
            {/* Pending tab */}
            <TabsTrigger value="pending" className="gap-2">
              <Clock className={cn('h-4 w-4', pending.length > 0 ? 'text-amber-500' : '')} />
              Pending Review
              {pending.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>

            {/* Approved tab */}
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Approved
              {approved.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {approved.length}
                </span>
              )}
            </TabsTrigger>

            {/* Rejected tab */}
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Rejected
              {rejected.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {rejected.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Pending ── */}
          <TabsContent value="pending" className="space-y-4">
            {pending.length === 0 ? (
              <EmptyTab
                icon={AlertTriangle}
                message="No courses pending review. All caught up!"
              />
            ) : (
              pending.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  feedback={feedback[course.id] ?? ''}
                  onFeedbackChange={val => setFeedback(f => ({ ...f, [course.id]: val }))}
                  onApprove={() => void actOnCourse(course.id, 'approved')}
                  onReject={() => void actOnCourse(course.id, 'disapproved')}
                  onDelete={() => void removeCourse(course.id)}
                  acting={acting === course.id}
                />
              ))
            )}
          </TabsContent>

          {/* ── Approved ── */}
          <TabsContent value="approved" className="space-y-4">
            {approved.length === 0 ? (
              <EmptyTab icon={CheckCircle2} message="No approved courses yet." />
            ) : (
              approved.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  feedback={feedback[course.id] ?? ''}
                  onFeedbackChange={val => setFeedback(f => ({ ...f, [course.id]: val }))}
                  // Allow re-rejecting an approved course
                  onReject={() => void actOnCourse(course.id, 'disapproved')}
                  onDelete={() => void removeCourse(course.id)}
                  acting={acting === course.id}
                />
              ))
            )}
          </TabsContent>

          {/* ── Rejected ── */}
          <TabsContent value="rejected" className="space-y-4">
            {rejected.length === 0 ? (
              <EmptyTab icon={XCircle} message="No rejected courses." />
            ) : (
              rejected.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  feedback={feedback[course.id] ?? ''}
                  onFeedbackChange={val => setFeedback(f => ({ ...f, [course.id]: val }))}
                  // Allow re-approving a rejected course
                  onApprove={() => void actOnCourse(course.id, 'approved')}
                  onDelete={() => void removeCourse(course.id)}
                  acting={acting === course.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
