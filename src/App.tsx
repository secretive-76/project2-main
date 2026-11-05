import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Upload, Users, BookOpen } from 'lucide-react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout/app-layout';
import { LandingPage } from '@/pages/landing';
import { LoginPage } from '@/pages/auth/login';
import { SignupPage } from '@/pages/auth/signup';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import { DashboardPage } from '@/pages/dashboard';
import { CatalogPage } from '@/pages/catalog';
import { CourseDetailPage } from '@/pages/course-detail';
import { CoursePlayerPage } from '@/pages/course-player';
import { QuizPage } from '@/pages/quiz';
import { AICoachPage } from '@/pages/ai-coach';
import { MyCoursesPage } from '@/pages/my-courses';
import { AchievementsPage } from '@/pages/achievements';
import { SettingsPage } from '@/pages/settings';
import { InstructorDashboard } from '@/pages/instructor-dashboard';
import { AdminDashboard } from '@/pages/admin-dashboard';
import { PlaceholderPage } from '@/pages/placeholder';
import { UnauthorizedPage } from '@/pages/unauthorized';
import { Toaster } from '@/components/ui/sonner';
import { InstructorCoursesPage } from '@/pages/instructor-courses';
import { InstructorGradingPage } from '@/pages/instructor-grading';
import { InstructorStudentsPage } from '@/pages/instructor-students';
import { InstructorDiscussionsPage } from '@/pages/instructor-discussions';
import { InstructorAiToolsPage } from '@/pages/instructor-ai-tools';
import { CourseFeedbackPage } from '@/pages/course-feedback';
import { InstructorMessagesPage } from '@/pages/instructor-messages';
import { AdminCoursesPage } from '@/pages/admin-courses';
import { AdminUsersPage } from '@/pages/admin-users';

function LegacyCourseRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={id ? `/student/courses/${encodeURIComponent(id)}` : '/student/browse'} state={location.state} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Separate Login Portals */}
            <Route path="/login" element={<LoginPage portalRole="student" />} />
            <Route path="/student/login" element={<LoginPage portalRole="student" />} />
            <Route path="/instructor/login" element={<LoginPage portalRole="instructor" />} />
            <Route path="/admin/login" element={<LoginPage portalRole="admin" />} />

            {/* Separate Signup Portals — admin signup is intentionally removed */}
            <Route path="/signup" element={<SignupPage portalRole="student" />} />
            <Route path="/student/signup" element={<SignupPage portalRole="student" />} />
            <Route path="/instructor/signup" element={<SignupPage portalRole="instructor" />} />
            {/* /admin/signup redirects to admin login — admin accounts are DB-seeded only */}
            <Route path="/admin/signup" element={<Navigate to="/admin/login" replace />} />

            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Student routes */}
            <Route path="/student" element={<ProtectedRoute allowedRole="student" />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/student/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="browse" element={<CatalogPage />} />
                <Route path="my-courses" element={<MyCoursesPage />} />
                <Route path="ai-coach" element={<AICoachPage />} />
                <Route path="achievements" element={<AchievementsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="courses/:slug" element={<CourseDetailPage />} />
                <Route path="courses/:slug/learn" element={<CoursePlayerPage />} />
                <Route path="courses/:slug/quiz/:lessonId" element={<QuizPage />} />
              </Route>
            </Route>

            <Route path="/courses/:id" element={<LegacyCourseRedirect />} />

            {/* Instructor routes */}
            <Route path="/instructor" element={<ProtectedRoute allowedRole="instructor" />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/instructor/dashboard" replace />} />
                <Route path="dashboard" element={<InstructorDashboard />} />
                <Route path="courses" element={<InstructorCoursesPage />} />
                <Route path="courses/:slug/preview" element={<CourseDetailPage />} />
                <Route path="courses/:slug/preview/learn" element={<CoursePlayerPage />} />
                <Route path="grading" element={<InstructorGradingPage />} />
                <Route path="students" element={<InstructorStudentsPage />} />
                <Route path="discussions" element={<InstructorDiscussionsPage />} />
                <Route path="discussions/:courseId" element={<InstructorDiscussionsPage />} />
                <Route path="messages" element={<InstructorMessagesPage />} />
                <Route path="ai-tools" element={<InstructorAiToolsPage />} />
                <Route path="feedback" element={<CourseFeedbackPage />} />
                <Route
                  path="upload"
                  element={
                    <PlaceholderPage
                      title="Upload Course"
                      description="Create and publish a new course."
                      icon={Upload}
                    />
                  }
                />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRole="admin" />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="feedback" element={<CourseFeedbackPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="courses" element={<AdminCoursesPage />} />
                <Route path="courses/:slug/preview" element={<CourseDetailPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Legacy /app redirect */}
            <Route path="/app/*" element={<Navigate to="/student/dashboard" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="bottom-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
