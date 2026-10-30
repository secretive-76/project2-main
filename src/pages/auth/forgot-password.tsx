import {
  useState,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Loader2,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  RefreshCcw,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE = 'http://localhost:8081';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'email' | 'otp' | 'password' | 'done';

// ── OTP input — 6 individual boxes (same pattern as signup) ──────────────────

interface OTPInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

function OTPInput({ value, onChange, disabled }: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        const next = [...value];
        next[idx] = '';
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...value];
    pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch; });
    onChange(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className="h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-bold tabular-nums shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          aria-label={`Reset code digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── Page wrapper card ─────────────────────────────────────────────────────────

function Card({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        {/* Icon */}
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconColor}`}>
          <Icon className="h-7 w-7" />
        </div>
        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');

  // Step 1
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Step 2
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const otpComplete = otpDigits.every(d => d !== '');

  const passwordChecks = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'One number', met: /\d/.test(newPassword) },
  ];
  const passwordValid = passwordChecks.every(c => c.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== '';

  // Cooldown timer
  const startCooldown = () => {
    setResendCooldown(60);
    const id = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: submit email → send OTP ───────────────────────────────────────

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send reset code');

      toast.success('Reset code sent!', {
        description: `Check your inbox at ${email}`,
      });
      setStep('otp');
      startCooldown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Step 2: verify OTP → move to new-password step ────────────────────────
  // We verify by calling reset-password with a dummy password first? No —
  // instead we do a lightweight pre-check: just advance to step 3 and pass the
  // OTP along. The actual password update (with OTP verification) happens in step 3.
  // This avoids consuming the OTP before the user sets their password.

  const handleOTPSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpComplete) return;
    // Advance to password step — OTP is verified server-side in the final step
    setStep('password');
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setEmailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');
      toast.success('New code sent!', { description: `Check your inbox at ${email}` });
      setOtpDigits(['', '', '', '', '', '']);
      startCooldown();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Step 3: submit new password + OTP → reset ─────────────────────────────

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValid || !passwordsMatch) return;
    setResetLoading(true);
    const otp = otpDigits.join('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If OTP is wrong/expired, send them back to OTP step
        if (res.status === 401 || res.status === 400) {
          setOtpDigits(['', '', '', '', '', '']);
          setStep('otp');
        }
        throw new Error(data.message || 'Failed to reset password');
      }

      setStep('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  // ── Render: step 1 — email ─────────────────────────────────────────────────

  if (step === 'email') {
    return (
      <Card
        icon={KeyRound}
        iconColor="bg-primary/10 text-primary"
        title="Forgot your password?"
        subtitle="Enter your account email and we'll send a 6-digit reset code."
      >
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={emailLoading || !email.trim()}>
            {emailLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…</>
              : <><ArrowRight className="mr-2 h-4 w-4" /> Send reset code</>
            }
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  // ── Render: step 2 — OTP entry ────────────────────────────────────────────

  if (step === 'otp') {
    return (
      <Card
        icon={ShieldCheck}
        iconColor="bg-blue-500/10 text-blue-600"
        title="Enter reset code"
        subtitle={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
      >
        <form onSubmit={handleOTPSubmit} className="space-y-6">
          <OTPInput value={otpDigits} onChange={setOtpDigits} disabled={otpLoading} />

          <Button type="submit" className="w-full" disabled={otpLoading || !otpComplete}>
            {otpLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
              : <><ArrowRight className="mr-2 h-4 w-4" /> Continue</>
            }
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={resendCooldown > 0 || emailLoading}
            onClick={handleResend}
            className="gap-1.5"
          >
            <RefreshCcw className="h-4 w-4" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </Button>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { setStep('email'); setOtpDigits(['', '', '', '', '', '']); }}
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
        </div>
      </Card>
    );
  }

  // ── Render: step 3 — new password ─────────────────────────────────────────

  if (step === 'password') {
    return (
      <Card
        icon={Lock}
        iconColor="bg-emerald-500/10 text-emerald-600"
        title="Set new password"
        subtitle="Choose a strong new password for your account."
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                placeholder="New password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <ul className="mt-2 space-y-1">
                {passwordChecks.map(c => (
                  <li
                    key={c.label}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${c.met ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {c.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`flex items-center gap-1.5 text-xs ${passwordsMatch ? 'text-emerald-500' : 'text-destructive'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={resetLoading || !passwordValid || !passwordsMatch}
          >
            {resetLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting password…</>
              : <><KeyRound className="mr-2 h-4 w-4" /> Reset password</>
            }
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline mx-auto"
            onClick={() => setStep('otp')}
          >
            <ArrowLeft className="h-3 w-3" /> Back to code entry
          </button>
        </div>
      </Card>
    );
  }

  // ── Render: step 4 — done ─────────────────────────────────────────────────

  return (
    <Card
      icon={CheckCircle2}
      iconColor="bg-emerald-500/10 text-emerald-600"
      title="Password reset!"
      subtitle="Your password has been updated successfully. You can now log in."
    >
      <div className="space-y-3">
        <Button className="w-full" onClick={() => navigate('/login')}>
          <ArrowRight className="mr-2 h-4 w-4" /> Go to login
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate('/instructor/login')}>
          Instructor login
        </Button>
      </div>
    </Card>
  );
}
