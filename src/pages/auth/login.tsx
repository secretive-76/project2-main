import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth, roleDashboardPath, roleLabels } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { UserRole } from '@/types';

const API_BASE = 'http://localhost:8081';

interface LoginPageProps {
  portalRole?: UserRole;
}

export function LoginPage({ portalRole }: LoginPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();

  // Explicitly prioritize portalRole prop passed from App.tsx
  const roleParam = searchParams.get('role') as UserRole | null;
  const activeRole: UserRole =
    portalRole ||
    (roleParam && ['student', 'instructor', 'admin'].includes(roleParam)
      ? roleParam
      : 'student');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let user;
      if (activeRole === 'admin') {
        // Admin uses a dedicated endpoint that only accepts admin-role accounts
        const res = await fetch(`${API_BASE}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Invalid email or password.');
        if (data.token) localStorage.setItem('akademia-token', data.token);
        // Let the shared signIn store the session — pass the token-backed user directly
        user = await signIn(email, password, 'admin');
      } else {
        user = await signIn(email, password, activeRole);
      }
      toast.success(`Welcome back, ${user.name}!`);
      navigate(roleDashboardPath[user.role]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const signupPath =
    activeRole === 'student' ? '/signup' : `/${activeRole}/signup`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {roleLabels[activeRole]} Portal Login
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your {activeRole} dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder={
                activeRole === 'admin'
                  ? 'admin@akademia.com'
                  : activeRole === 'instructor'
                  ? 'instructor@akademia.com'
                  : 'student@akademia.com'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {activeRole !== 'admin' && (
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot your password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : `Sign in as ${roleLabels[activeRole]}`}
          </Button>
        </form>

        {/* Admin portal has no self-signup — account is set by the platform */}
        {activeRole !== 'admin' && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to={signupPath}
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}