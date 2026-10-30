import { useAuth } from '@/components/providers/auth-provider';
import { DashboardPage } from '@/pages/dashboard';
import { InstructorDashboard } from '@/pages/instructor-dashboard';
import { AdminDashboard } from '@/pages/admin-dashboard';
import type { UserRole } from '@/types';

export function DashboardRouter() {
  const { user } = useAuth();
  const role: UserRole = user?.role ?? 'student';

  if (role === 'instructor') return <InstructorDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  return <DashboardPage />;
}
