import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, roleDashboardPath } from '@/components/providers/auth-provider';
import { FullScreenLoader } from '@/components/common/full-screen-loader';
import { UnauthorizedPage } from '@/pages/unauthorized';
import type { UserRole } from '@/types';

export function ProtectedRoute({ allowedRole }: { allowedRole?: UserRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
