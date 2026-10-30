import { useState, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserRole } from '@/types';

const API_BASE = 'http://localhost:8081';

interface SignupPageProps {
  portalRole?: UserRole;
}

// ── OTP input — 6 individual boxes ───────────────────────────────────────────

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
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
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
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SignupPage({ portalRole = 'student' }: SignupPageProps) {
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // OTP step state
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const roleTitle = portalRole.charAt(0).toUpperCase() + portalRole.slice(1);
  const loginPath = portalRole === 'student' ? '/login' : `/${portalRole}/login`;

  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
  ];
  const canSubmit = passwordChecks.every(c => c.met) && agreed && name.trim() && email.trim();
  const otpComplete = otpDigits.every(d => d !== '');

  // Cooldown timer after resend
  const startCooldown = () => {
    setResendCooldown(60);
    const id = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: submit form → send OTP ────────────────────────────────────────

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: portalRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');

      toast.success('Verification code sent!', {
        description: `Check your inbox at ${email}`,
      });
      setStep('otp');
      startCooldown();
    } catch (err) {
      toast.error('Sign-up failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // ── Step 2: verify OTP → create account ──────────────────────────────────

  const handleOTPSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpComplete) return;
    setOtpLoading(true);
    const otp = otpDigits.join('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid verification code');

      toast.success('Email verified!', {
        description: 'Your account is pending admin approval. You can log in once approved.',
        duration: 8000,
      });
      navigate(loginPath, { replace: true });
    } catch (err) {
      toast.error('Verification failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
      // Clear OTP boxes on failure so user can re-enter
      setOtpDigits(['', '', '', '', '', '']);
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setFormLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: portalRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend code');
      toast.success('New code sent!', { description: `Check your inbox at ${email}` });
      setOtpDigits(['', '', '', '', '', '']);
      startCooldown();
    } catch (err) {
      toast.error('Resend failed', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // ── Render: OTP step ──────────────────────────────────────────────────────

  if (step === 'otp') {
    return (
      <AuthLayout
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email}. Enter it below to continue.`}
      >
        <form onSubmit={handleOTPSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm">Enter your 6-digit verification code</span>
            </div>
            <OTPInput value={otpDigits} onChange={setOtpDigits} disabled={otpLoading} />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={otpLoading || !otpComplete}
          >
            {otpLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Verify &amp; Create Account</>
            )}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={resendCooldown > 0 || formLoading}
            onClick={handleResend}
            className="gap-1.5"
          >
            <RefreshCcw className="h-4 w-4" />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => { setStep('form'); setOtpDigits(['', '', '', '', '', '']); }}
          >
            ← Back to sign up form
          </button>
        </div>
      </AuthLayout>
    );
  }

  // ── Render: signup form ───────────────────────────────────────────────────

  return (
    <AuthLayout
      title={`Create your ${portalRole} account`}
      subtitle={
        portalRole === 'instructor'
          ? 'Share your knowledge and empower thousands of learners.'
          : 'Start learning with an AI coach that adapts to you.'
      }
    >
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-9 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <ul className="mt-2 space-y-1">
              {passwordChecks.map(c => (
                <li
                  key={c.label}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${c.met ? 'text-green-500' : 'text-muted-foreground'}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {c.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={v => setAgreed(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm text-muted-foreground">
            I agree to the{' '}
            <span className="font-medium text-foreground">Terms of Service</span> and{' '}
            <span className="font-medium text-foreground">Privacy Policy</span>
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={formLoading || !canSubmit}>
          {formLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending verification code…</>
          ) : (
            <>Create {roleTitle} account <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={loginPath} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
