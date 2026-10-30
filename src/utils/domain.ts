import type { UserRole } from '@/types';

const STORAGE_KEY = 'akademia-dev-domain-override';

/**
 * Returns the role inferred from the current hostname.
 * - 'instructor' if hostname contains 'instructor'
 * - 'admin' if hostname contains 'admin'
 * - defaults to 'student'
 *
 * In development (localhost), a localStorage override set by <DevDomainToggle />
 * takes precedence so each portal's login UI can be previewed without DNS.
 */
export function getRoleFromDomain(): UserRole {
  if (typeof window === 'undefined') return 'student';

  try {
    const override = window.localStorage.getItem(STORAGE_KEY);
    if (override === 'student' || override === 'instructor' || override === 'admin') {
      return override;
    }
  } catch {
    // ignore storage errors
  }

  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('admin')) return 'admin';
  if (hostname.includes('instructor')) return 'instructor';
  return 'student';
}

/**
 * Returns a stable accent class map for a given role, used to theme
 * domain-specific login surfaces.
 */
export function roleAccent(role: UserRole): {
  text: string;
  bg: string;
  border: string;
  ring: string;
  gradient: string;
} {
  switch (role) {
    case 'instructor':
      return {
        text: 'text-teal',
        bg: 'bg-teal/10',
        border: 'border-teal/30',
        ring: 'ring-teal/30',
        gradient: 'from-teal/15 via-transparent to-indigo/10',
      };
    case 'admin':
      return {
        text: 'text-warning',
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        ring: 'ring-warning/30',
        gradient: 'from-warning/15 via-transparent to-destructive/10',
      };
    default:
      return {
        text: 'text-primary',
        bg: 'bg-primary/10',
        border: 'border-primary/30',
        ring: 'ring-primary/30',
        gradient: 'from-primary/15 via-transparent to-indigo/10',
      };
  }
}

export const DEV_DOMAIN_STORAGE_KEY = STORAGE_KEY;
