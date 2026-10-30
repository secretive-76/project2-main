import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserRole } from '@/types';
import { resetStudentPortalState } from '@/lib/student-api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<AuthUser>;
  login: (email: string, password: string, role?: UserRole) => Promise<AuthUser>;
  signUp: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  signOut: () => void;
}

const SESSION_KEY = 'akademia-session';
const API_BASE = 'http://localhost:8081';

/** Default avatar based on role */
function defaultAvatar(role: UserRole): string {
  void role;
  return '';
}

/** Shape the raw API user object into an AuthUser */
function toAuthUser(raw: { id: number | string; name: string; email: string; role: string }): AuthUser {
  return {
    id: String(raw.id),
    name: raw.name,
    email: raw.email,
    role: raw.role as UserRole,
    avatarUrl: defaultAvatar(raw.role as UserRole),
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on app load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
    } catch {
      // ignore corrupted storage
    }
    setLoading(false);
  }, []);

  /**
   * Register a new account via the backend.
   * Does NOT sign in — caller is responsible for redirecting to login.
   */
  const signUp = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
    } catch {
      throw new Error(
        'Cannot reach the server. Make sure the backend is running on port 8081.'
      );
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to create account. Please try again.');
    }
    // Account created — do not set session, let the user log in manually
  };

  /**
   * Sign in via the backend. Falls back to demo accounts if the backend
   * is unreachable (so development without a running server still works).
   */
  const signIn = async (email: string, password: string, role?: UserRole): Promise<AuthUser> => {
    let authedUser: AuthUser;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      authedUser = toAuthUser(data.user);

      // Store the JWT for future authenticated requests
      if (data.token) {
        localStorage.setItem('akademia-token', data.token);
      }
    } catch (err: unknown) {
      // If the error is a known API error (has a message we set), rethrow it
      if (err instanceof Error && !err.message.includes('fetch')) {
        throw err;
      }
      // Admin login never falls back to demo accounts — the backend must be reachable
      if (role === 'admin') {
        throw new Error('Cannot reach the server. Make sure the backend is running on port 8081.');
      }
      // Backend is unreachable — fall back to demo accounts (student/instructor only)
      authedUser = signInDemo(email, password);
    }

    // Enforce portal role if specified
    if (role && authedUser.role !== role) {
      throw new Error(
        `This account is registered as a ${authedUser.role}. Please use the ${authedUser.role} login portal.`
      );
    }

    // Prevent a previous user's enrollment/progress cache being shown after a
    // different account signs in on the same browser.
    resetStudentPortalState();
    localStorage.setItem(SESSION_KEY, JSON.stringify(authedUser));
    setUser(authedUser);
    return authedUser;
  };

  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('akademia-token');
    resetStudentPortalState();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, login: signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Demo account fallback — only used when the backend is not running.
 *  Admin is intentionally excluded: admin login always requires the live backend. */
const DEMO_ACCOUNTS = [
  { email: 'student@akademia.com', password: 'student123', user: { id: 'u_student', name: 'Alex Rivera', email: 'student@akademia.com', role: 'student' as UserRole, avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop&crop=faces&q=80' } },
  { email: 'instructor@akademia.com', password: 'instructor123', user: { id: 'u_instructor', name: 'Dr. Sarah Chen', email: 'instructor@akademia.com', role: 'instructor' as UserRole, avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces&q=80' } },
];

function signInDemo(email: string, password: string): AuthUser {
  const normalized = email.toLowerCase().trim();
  const match = DEMO_ACCOUNTS.find(
    (a) => a.email === normalized && a.password === password
  );
  if (!match) {
    const emailMatch = DEMO_ACCOUNTS.find((a) => a.email === normalized);
    if (emailMatch) throw new Error('Incorrect password. Please try again.');
    throw new Error('No account found with that email. Please sign up first.');
  }
  return match.user;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const roleDashboardPath: Record<UserRole, string> = {
  student: '/student/dashboard',
  instructor: '/instructor/dashboard',
  admin: '/admin/dashboard',
};

export const roleLabels: Record<UserRole, string> = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
};
