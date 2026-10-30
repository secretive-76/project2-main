import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { box: 'h-7 w-7', text: 'text-lg', icon: 16 },
  md: { box: 'h-9 w-9', text: 'text-xl', icon: 20 },
  lg: { box: 'h-11 w-11', text: 'text-2xl', icon: 24 },
};

export function Logo({ className, showWordmark = true, size = 'md' }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative grid place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm',
          s.box
        )}
      >
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M7 16c0-3 2.5-5 5-5s5 2 5 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="8" r="2.5" fill="currentColor" />
        </svg>
      </div>
      {showWordmark && (
        <span className={cn('font-semibold tracking-tight text-foreground', s.text)}>
          Akademia
        </span>
      )}
    </div>
  );
}
