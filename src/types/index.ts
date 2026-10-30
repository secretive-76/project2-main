export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type CourseStatus = 'not-started' | 'in-progress' | 'completed';

export type LearningPathStatus = 'active' | 'completed' | 'paused';

export interface Instructor {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  rating: number;
  students: number;
}

export interface Lesson {
  id: string;
  title: string;
  durationMinutes: number;
  type: 'video' | 'reading' | 'quiz' | 'assignment' | 'ai-coaching';
  completed: boolean;
  description?: string;
  videoUrl?: string;
  pdfUrl?: string;
  readingContent?: string;
  resources?: { label: string; url: string }[];
  quizQuestions?: { question: string; choices: string[] }[];
  quizQuestionCount?: number;
  quizTotalMarks?: number;
  timeLimitMinutes?: number;
  assignmentTitle?: string;
  assignmentDescription?: string;
  assignmentPoints?: number;
  assignmentSubmitted?: boolean;
}

export interface CourseMessage {
  id: string;
  user_id: string;
  student_id?: number;
  sender_id?: number;
  course_id: string;
  sender_role: 'student' | 'instructor';
  content: string;
  created_at: string;
}

export interface CourseCertificate {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  completedAt: string;
  certificateId: string;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  thumbnailUrl: string;
  rating: number;
  reviews: number;
  enrolled: number;
  durationHours: number;
  instructor: Instructor;
  tags: string[];
  modules: Module[];
  status: CourseStatus;
  progress: number;
  externalUrl?: string;
  provider?: string;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  courseCount: number;
  estimatedWeeks: number;
  status: LearningPathStatus;
  progress: number;
  thumbnailUrl: string;
  aiGenerated: boolean;
}

export interface Skill {
  id: string;
  name: string;
  proficiency: number;
  category: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface ActivityItem {
  id: string;
  type: 'lesson-completed' | 'course-started' | 'achievement' | 'quiz-passed' | 'streak' | 'ai-coaching' | 'course-completed';
  title: string;
  detail: string;
  timestamp: string;
  courseId?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  preview: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface DashboardStats {
  coursesCompleted: number;
  hoursLearned: number;
  currentStreak: number;
  skillPoints: number;
  weeklyGoalMinutes: number;
  weeklyAchievedMinutes: number;
}

export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  plan: 'free' | 'pro' | 'team';
  joinedAt: string;
  role: UserRole;
}

export interface InstructorCourse {
  id: string;
  title: string;
  thumbnailUrl: string;
  students: number;
  rating: number;
  revenue: number;
  completionRate: number;
  publishedAt: string;
  status: 'published' | 'draft' | 'in-review';
}

export interface StudentProgress {
  id: string;
  name: string;
  avatarUrl: string;
  course: string;
  progress: number;
  lastActive: string;
  status: 'active' | 'idle' | 'completed';
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  students: number;
}

export interface PlatformStat {
  label: string;
  value: string;
  change: number;
  icon: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  joinedAt: string;
  status: 'active' | 'suspended' | 'pending';
  coursesEnrolled: number;
}

export interface AdminCourse {
  id: string;
  title: string;
  instructor: string;
  category: string;
  students: number;
  rating: number;
  status: 'published' | 'draft' | 'in-review' | 'flagged';
  reportedAt?: string;
}

export interface SystemHealth {
  service: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: string;
  latency: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  questionCount: number;
  estimatedMinutes: number;
  bestScore: number;
  attempts: number;
  lastAttempted: string | null;
  questions: QuizQuestion[];
}

export interface Lab {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  techStack: string[];
  thumbnailUrl: string;
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
  skills: string[];
}
