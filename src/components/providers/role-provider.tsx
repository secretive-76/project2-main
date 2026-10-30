import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserRole } from '@/types';

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const STORAGE_KEY = 'akademia-role';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'student';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'student' || stored === 'instructor' || stored === 'admin') return stored;
    return 'student';
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    window.localStorage.setItem(STORAGE_KEY, newRole);
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  return (
    <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
