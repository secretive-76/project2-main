export interface CourseFeedback {
  id: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  studentName: string;
  rating: number;
  message: string;
  createdAt: string;
}

const FEEDBACK_KEY = 'akademia-course-feedback';

function readFeedback(): CourseFeedback[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function getCourseFeedback(): CourseFeedback[] {
  return readFeedback().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveCourseFeedback(
  feedback: Omit<CourseFeedback, 'id' | 'createdAt'>
): CourseFeedback {
  const entry: CourseFeedback = {
    ...feedback,
    id: `feedback-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify([entry, ...readFeedback()]));
  }
  return entry;
}
