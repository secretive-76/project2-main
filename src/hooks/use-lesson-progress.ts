import { useCallback, useEffect, useState } from 'react';
import { getDemoCompletedLessonIds, saveDemoLessonCompletion } from '@/lib/course-utils';
import { useAuth } from '@/components/providers/auth-provider';
import { loadStudentPortalState, saveStudentLessonProgress } from '@/lib/student-api';

export function useLessonProgress(courseId: string) {
  const { user } = useAuth();
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    () => new Set(getDemoCompletedLessonIds(courseId))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !courseId) {
      setCompletedLessons(new Set(getDemoCompletedLessonIds(courseId)));
      setLoading(false);
      return;
    }
    let cancelled = false;

    loadStudentPortalState().then((state) => {
      if (!cancelled) setCompletedLessons(new Set(state.completedLessonIds[courseId] ?? []));
    }).catch(() => {
      if (!cancelled) setCompletedLessons(new Set(getDemoCompletedLessonIds(courseId)));
    }).finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
    };
  }, [user, courseId]);

  const toggleLesson = useCallback(
    async (lessonId: string, completed: boolean, courseComplete = false, durationMinutes = 0) => {
      if (!user) return;

      setCompletedLessons((prev) => {
        const next = new Set(prev);
        if (completed) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });

      try {
        await saveStudentLessonProgress(courseId, lessonId, completed, courseComplete, durationMinutes);
      } catch (err) {
        // Keep preview mode available if the API has not been started yet.
        saveDemoLessonCompletion(courseId, lessonId, completed);
        setCompletedLessons((prev) => {
          const next = new Set(prev);
          if (!completed) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
      }
    },
    [user, courseId, completedLessons]
  );

  const markComplete = useCallback(
    (lessonId: string, courseComplete = false, durationMinutes = 0) => toggleLesson(lessonId, true, courseComplete, durationMinutes),
    [toggleLesson]
  );

  const isCompleted = useCallback(
    (lessonId: string) => completedLessons.has(lessonId),
    [completedLessons]
  );

  return { completedLessons, loading, markComplete, toggleLesson, isCompleted };
}
