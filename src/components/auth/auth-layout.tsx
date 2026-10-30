import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Quote } from 'lucide-react';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/common/theme-toggle';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — form panel */}
      <div className="flex w-full flex-col px-6 py-8 sm:px-12 lg:w-[480px] lg:px-16">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Logo size="md" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Akademia. All rights reserved.
        </p>
      </div>

      {/* Right — visual panel */}
      <div className="relative hidden overflow-hidden bg-foreground lg:block lg:flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-foreground to-indigo/20" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative flex h-full flex-col justify-center p-16">
          <Sparkles className="mb-6 h-10 w-10 text-teal" />
          <p className="max-w-md text-balance text-2xl font-medium leading-snug text-background">
            Akademia doesn't just teach you. It learns you — adapting every lesson, quiz, and
            coaching session to how you actually think.
          </p>
          <div className="mt-10 flex items-center gap-4 rounded-2xl border border-background/10 bg-background/5 p-5 backdrop-blur-sm">
            <Quote className="h-8 w-8 shrink-0 text-primary/80" />
            <div>
              <p className="text-sm text-background/90">
                "I went from copy-pasting tutorials to actually understanding transformers in
                three weeks. The AI coach caught gaps I didn't know I had."
              </p>
              <p className="mt-2 text-sm font-medium text-background">
                Jordan K. — ML Engineer at Hugging Face
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-8">
            {[
              ['120K+', 'Learners'],
              ['4.9/5', 'Avg. rating'],
              ['94%', 'Course completion'],
            ].map(([stat, label]) => (
              <div key={label}>
                <p className="text-2xl font-semibold text-background">{stat}</p>
                <p className="text-xs text-background/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
