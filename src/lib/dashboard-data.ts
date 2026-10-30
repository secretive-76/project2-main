import type {
  InstructorCourse,
  StudentProgress,
  RevenuePoint,
  PlatformStat,
  AdminUser,
  AdminCourse,
  SystemHealth,
} from '@/types';

// ============================================================
// Instructor mock data
// ============================================================

export const instructorCourses: InstructorCourse[] = [
  {
    id: 'ic_1',
    title: 'Transformers from Scratch',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=250&fit=crop&q=80',
    students: 12483,
    rating: 4.8,
    revenue: 87420,
    completionRate: 72,
    publishedAt: '2025-03-15',
    status: 'published',
  },
  {
    id: 'ic_2',
    title: 'Production LLM Applications',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=250&fit=crop&q=80',
    students: 8920,
    rating: 4.9,
    revenue: 62340,
    completionRate: 68,
    publishedAt: '2025-01-20',
    status: 'published',
  },
  {
    id: 'ic_3',
    title: 'Advanced Attention Mechanisms',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1518186285589-98f764515d60?w=400&h=250&fit=crop&q=80',
    students: 0,
    rating: 0,
    revenue: 0,
    completionRate: 0,
    publishedAt: '2026-08-10',
    status: 'in-review',
  },
  {
    id: 'ic_4',
    title: 'ML System Design Workshop',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=250&fit=crop&q=80',
    students: 0,
    rating: 0,
    revenue: 0,
    completionRate: 0,
    publishedAt: '2026-09-01',
    status: 'draft',
  },
];

export const studentProgress: StudentProgress[] = [
  {
    id: 'sp_1',
    name: 'Jamie Chen',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Transformers from Scratch',
    progress: 85,
    lastActive: '2h ago',
    status: 'active',
  },
  {
    id: 'sp_2',
    name: 'Maya Patel',
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Production LLM Applications',
    progress: 100,
    lastActive: '1d ago',
    status: 'completed',
  },
  {
    id: 'sp_3',
    name: 'Liam O\'Brien',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Transformers from Scratch',
    progress: 42,
    lastActive: '5h ago',
    status: 'active',
  },
  {
    id: 'sp_4',
    name: 'Sofia Garcia',
    avatarUrl:
      'https://images.unsplash.com/photo-1534568741605-21f2e4c825data?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Production LLM Applications',
    progress: 28,
    lastActive: '3d ago',
    status: 'idle',
  },
  {
    id: 'sp_5',
    name: 'Noah Williams',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Transformers from Scratch',
    progress: 67,
    lastActive: '30m ago',
    status: 'active',
  },
  {
    id: 'sp_6',
    name: 'Emma Zhang',
    avatarUrl:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=64&h=64&fit=crop&crop=faces&q=80',
    course: 'Production LLM Applications',
    progress: 15,
    lastActive: '1w ago',
    status: 'idle',
  },
];

export const revenueData: RevenuePoint[] = [
  { month: 'Feb', revenue: 8200, students: 180 },
  { month: 'Mar', revenue: 12400, students: 240 },
  { month: 'Apr', revenue: 15800, students: 310 },
  { month: 'May', revenue: 14200, students: 285 },
  { month: 'Jun', revenue: 18900, students: 380 },
  { month: 'Jul', revenue: 22300, students: 420 },
  { month: 'Aug', revenue: 25600, students: 470 },
];

export const instructorReviews = [
  {
    id: 'r_1',
    student: 'Jamie Chen',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=faces&q=80',
    course: 'Transformers from Scratch',
    rating: 5,
    comment: 'The best explanation of attention I have ever seen. The visual diagrams made it click.',
    date: '2d ago',
  },
  {
    id: 'r_2',
    student: 'Maya Patel',
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=faces&q=80',
    course: 'Production LLM Applications',
    rating: 5,
    comment: 'Finally a course that goes beyond demos. The eval-first approach transformed how I build.',
    date: '5d ago',
  },
  {
    id: 'r_3',
    student: 'Liam O\'Brien',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=faces&q=80',
    course: 'Transformers from Scratch',
    rating: 4,
    comment: 'Great content, would love more coding exercises in the early modules.',
    date: '1w ago',
  },
];

// ============================================================
// Admin mock data
// ============================================================

export const platformStats: PlatformStat[] = [
  { label: 'Total users', value: '48,293', change: 12.4, icon: 'users' },
  { label: 'Active courses', value: '342', change: 8.1, icon: 'book' },
  { label: 'Monthly revenue', value: '$284K', change: 18.7, icon: 'dollar' },
  { label: 'Completion rate', value: '74.2%', change: 3.2, icon: 'check' },
];

export const userGrowthData: RevenuePoint[] = [
  { month: 'Feb', revenue: 0, students: 38400 },
  { month: 'Mar', revenue: 0, students: 39800 },
  { month: 'Apr', revenue: 0, students: 41200 },
  { month: 'May', revenue: 0, students: 43100 },
  { month: 'Jun', revenue: 0, students: 44800 },
  { month: 'Jul', revenue: 0, students: 46500 },
  { month: 'Aug', revenue: 0, students: 48293 },
];

export const categoryDistribution = [
  { category: 'Machine Learning', courses: 78, percentage: 23 },
  { category: 'Web Development', courses: 65, percentage: 19 },
  { category: 'Data Science', courses: 52, percentage: 15 },
  { category: 'Cloud & DevOps', courses: 48, percentage: 14 },
  { category: 'Mobile', courses: 41, percentage: 12 },
  { category: 'Other', courses: 58, percentage: 17 },
];

export const adminUsers: AdminUser[] = [
  {
    id: 'au_1',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'student',
    joinedAt: '2024-09-12',
    status: 'active',
    coursesEnrolled: 7,
  },
  {
    id: 'au_2',
    name: 'Dr. Sarah Kim',
    email: 'sarah.kim@lumina.edu',
    avatarUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'instructor',
    joinedAt: '2024-06-01',
    status: 'active',
    coursesEnrolled: 0,
  },
  {
    id: 'au_3',
    name: 'Marcus Johnson',
    email: 'marcus.j@example.com',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'student',
    joinedAt: '2025-01-15',
    status: 'suspended',
    coursesEnrolled: 3,
  },
  {
    id: 'au_4',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'instructor',
    joinedAt: '2024-11-20',
    status: 'active',
    coursesEnrolled: 0,
  },
  {
    id: 'au_5',
    name: 'Tom Bradley',
    email: 'tom.b@example.com',
    avatarUrl:
      'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'student',
    joinedAt: '2026-07-28',
    status: 'pending',
    coursesEnrolled: 0,
  },
  {
    id: 'au_6',
    name: 'Yuki Tanaka',
    email: 'yuki.t@example.com',
    avatarUrl:
      'https://images.unsplash.com/photo-1519345182560-3f2917c47205?w=40&h=40&fit=crop&crop=faces&q=80',
    role: 'student',
    joinedAt: '2025-03-04',
    status: 'active',
    coursesEnrolled: 12,
  },
];

export const adminCourses: AdminCourse[] = [
  {
    id: 'ac_1',
    title: 'Transformers from Scratch',
    instructor: 'Dr. Sarah Kim',
    category: 'Machine Learning',
    students: 12483,
    rating: 4.8,
    status: 'published',
  },
  {
    id: 'ac_2',
    title: 'Full-Stack React & Node',
    instructor: 'Priya Sharma',
    category: 'Web Development',
    students: 8210,
    rating: 4.7,
    status: 'published',
  },
  {
    id: 'ac_3',
    title: 'Data Structures Masterclass',
    instructor: 'Marcus Johnson',
    category: 'Computer Science',
    students: 3402,
    rating: 3.2,
    status: 'flagged',
    reportedAt: '3h ago',
  },
  {
    id: 'ac_4',
    title: 'Advanced Attention Mechanisms',
    instructor: 'Dr. Sarah Kim',
    category: 'Machine Learning',
    students: 0,
    rating: 0,
    status: 'in-review',
  },
  {
    id: 'ac_5',
    title: 'ML System Design Workshop',
    instructor: 'Dr. Sarah Kim',
    category: 'Machine Learning',
    students: 0,
    rating: 0,
    status: 'draft',
  },
];

export const systemHealth: SystemHealth[] = [
  { service: 'API Gateway', status: 'operational', uptime: '99.98%', latency: '42ms' },
  { service: 'Database (Postgres)', status: 'operational', uptime: '99.99%', latency: '12ms' },
  { service: 'Video Streaming', status: 'operational', uptime: '99.95%', latency: '85ms' },
  { service: 'AI Coach Engine', status: 'degraded', uptime: '98.21%', latency: '340ms' },
  { service: 'Auth Service', status: 'operational', uptime: '100%', latency: '28ms' },
  { service: 'File Storage', status: 'operational', uptime: '99.97%', latency: '55ms' },
];
