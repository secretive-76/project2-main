import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth, roleDashboardPath } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';

export function UnauthorizedPage() {
  const { user } = useAuth();
  const redirectPath = user ? roleDashboardPath[user.role] : '/login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-destructive/10">
        <ShieldX className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">403</h1>
      <p className="mt-2 text-lg font-semibold text-foreground">Access Denied</p>
      <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
        You don't have permission to access this page. This area is restricted to a different role.
      </p>
      <Button asChild className="mt-6">
        <Link to={redirectPath}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to your dashboard
        </Link>
      </Button>
    </div>
  );
}
