import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

export type EnrollmentStatus = 'saved' | 'in-progress' | 'completed';

export interface StudentEnrollment {
  course_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at?: string;
}

interface ProgressRecord {
  course_id: string;
  lesson_id: string;
  completed: boolean;
}

export interface StudentPortalState {
  enrollments: StudentEnrollment[];
  completedLessonIds: Record<string, string[]>;
}

const emptyState: StudentPortalState = { enrollments: [], completedLessonIds: {} };
let cachedState: StudentPortalState | null = null;
let inFlight: Promise<StudentPortalState> | null = null;
const listeners = new Set<(state: StudentPortalState) => void>();

function publish(state: StudentPortalState) {
  cachedState = state;
  listeners.forEach((listener) => listener(state));
}

function toState(data: { enrollments?: StudentEnrollment[]; lesson_progress?: ProgressRecord[] }): StudentPortalState {
  const completedLessonIds: Record<string, string[]> = {};
  for (const progress of data.lesson_progress ?? []) {
    if (!progress.completed) continue;
    (completedLessonIds[progress.course_id] ??= []).push(progress.lesson_id);
  }
  return { enrollments: data.enrollments ?? [], completedLessonIds };
}

export async function loadStudentPortalState(force = false): Promise<StudentPortalState> {
  if (cachedState && !force) return cachedState;
  if (!inFlight) {
    inFlight = apiRequest('/student/state')
      .then((data) => {
        const state = toState(data);
        publish(state);
        return state;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function resetStudentPortalState() {
  cachedState = null;
  inFlight = null;
  listeners.forEach((listener) => listener(emptyState));
}

export function useStudentPortalState() {
  const [state, setState] = useState<StudentPortalState>(cachedState ?? emptyState);
  const [loading, setLoading] = useState(!cachedState);

  useEffect(() => {
    const listener = (next: StudentPortalState) => setState(next);
    listeners.add(listener);
    loadStudentPortalState()
      .catch(() => {
        // The existing demo data remains usable only while a backend is offline.
      })
      .finally(() => setLoading(false));
    return () => { listeners.delete(listener); };
  }, []);

  return { state, loading };
}

export function enrollmentForCourse(courseId: string): StudentEnrollment | undefined {
  return cachedState?.enrollments.find((item) => item.course_id === courseId);
}

export function completedLessonIdsForCourse(courseId: string): string[] | undefined {
  return cachedState?.completedLessonIds[courseId];
}

export async function enrollStudent(courseId: string): Promise<StudentEnrollment> {
  const enrollment = await apiRequest('/student/enrollments', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId }),
  }) as StudentEnrollment;
  const state = cachedState ?? emptyState;
  publish({
    ...state,
    enrollments: [...state.enrollments.filter((item) => item.course_id !== courseId), enrollment],
  });
  return enrollment;
}

export async function saveStudentLessonProgress(
  courseId: string,
  lessonId: string,
  completed: boolean,
  courseComplete: boolean,
  durationMinutes = 0,
) {
  const result = await apiRequest('/student/lesson-progress', {
    method: 'POST',
    body: JSON.stringify({
      course_id: courseId,
      lesson_id: lessonId,
      completed,
      course_complete: courseComplete,
      duration_minutes: durationMinutes,
    }),
  }) as { course_status: EnrollmentStatus };

  const state = cachedState ?? emptyState;
  const ids = new Set(state.completedLessonIds[courseId] ?? []);
  if (completed) ids.add(lessonId); else ids.delete(lessonId);
  const current = state.enrollments.find((item) => item.course_id === courseId);
  publish({
    enrollments: [
      ...state.enrollments.filter((item) => item.course_id !== courseId),
      current
        ? { ...current, status: result.course_status }
        : { course_id: courseId, status: result.course_status, enrolled_at: new Date().toISOString() },
    ],
    completedLessonIds: { ...state.completedLessonIds, [courseId]: [...ids] },
  });
}

export interface LearningSummary {
  courses_completed: number;
  minutes_learned: number;
  hours_learned: number;
  current_streak: number;
  skill_points: number;
  quiz_attempts: number;
  quizzes_passed: number;
  quizzes_90_plus: number;
  perfect_quizzes: number;
  assignments_submitted: number;
}

// Dashboard, achievements, and course progress share this one server-computed
// learning record. Never mix it with the older demo summary endpoint.
export const loadLearningSummary = () => apiRequest('/student/dashboard') as Promise<LearningSummary>;

export const saveQuizAttempt = (quizId: string, score: number, totalQuestions: number, correctAnswers: number) =>
  apiRequest('/student/quiz-attempts', { method: 'POST', body: JSON.stringify({ quiz_id: quizId, score, total_questions: totalQuestions, correct_answers: correctAnswers }) });

export async function submitAssignment(courseId: string, lessonId: string, file: File) {
  const token = localStorage.getItem('akademia-token');
  const data = new FormData(); data.append('course_id', courseId); data.append('lesson_id', lessonId); data.append('assignment_file', file);
  const response = await fetch('http://localhost:8081/api/student/assignments/submit', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: data });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || 'Could not submit assignment');
  }
  return response.json();
}

export interface StudentQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  position: number;
}

export async function loadStudentQuiz(lessonId: string): Promise<{ questions: StudentQuizQuestion[]; time_limit_minutes: number; time_limit_seconds: number }> {
  return apiRequest(`/student/lessons/${encodeURIComponent(lessonId)}/quiz`);
}

export interface StudentQuizResult {
  score: number;
  correct_answers: number;
  total_questions: number;
  correct_choices: { question_id: string; correct_choice: number }[];
}

export async function submitStudentQuiz(lessonId: string, answers: number[]): Promise<StudentQuizResult> {
  return apiRequest('/student/quizzes/submit', {
    method: 'POST',
    body: JSON.stringify({ lesson_id: lessonId, answers }),
  });
}

export async function submitStudentFeedback(courseId: string, rating: number, message: string) {
  return apiRequest('/student/feedback', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId, rating, message }),
  });
}

export interface MySubmission {
  lesson_id: string;
  course_id: string;
  file_name: string;
  submitted_at: string;
}

/** Returns all assignment submissions made by the logged-in student. */
export async function getMyAssignmentSubmissions(): Promise<MySubmission[]> {
  const data = await apiRequest('/student/my-submissions') as { submissions: MySubmission[] };
  return data.submissions ?? [];
}

// ---------------------------------------------------------------------------
// Course discussion helpers
// ---------------------------------------------------------------------------

export interface Discussion {
  id: number;
  title: string;
  content: string;
  status: 'needs_answer' | 'answered';
  created_at: string;
  reply_count: number;
  student?: { id: number; name: string };
}

export interface DiscussionReply {
  id: number;
  content: string;
  created_at: string;
  user?: { id: number; name: string; role: string };
}

/** Fetch all discussion threads for a course the student is enrolled in. */
export async function listCourseDiscussions(courseId: string): Promise<Discussion[]> {
  const data = await apiRequest(
    `/student/discussions?course_id=${encodeURIComponent(courseId)}`
  ) as { discussions: Discussion[] };
  return data.discussions ?? [];
}

/** Open a new discussion thread in a course. */
export async function postDiscussion(
  courseId: string,
  title: string,
  content: string,
): Promise<Discussion> {
  return apiRequest('/student/discussions', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId, title, content }),
  }) as Promise<Discussion>;
}

/** Fetch all replies for a single discussion thread. */
export async function getDiscussionReplies(discussionId: number): Promise<DiscussionReply[]> {
  const data = await apiRequest(
    `/student/discussions/replies?discussion_id=${discussionId}`
  ) as { replies: DiscussionReply[] };
  return data.replies ?? [];
}

/** Post a follow-up reply on an existing discussion thread. */
export async function postDiscussionReply(
  discussionId: number,
  content: string,
): Promise<DiscussionReply> {
  return apiRequest(
    `/student/discussions/replies?discussion_id=${discussionId}`,
    { method: 'POST', body: JSON.stringify({ content }) },
  ) as Promise<DiscussionReply>;
}
