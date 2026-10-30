import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { icon: 'h-8 w-8', box: 'h-12 w-12', title: 'text-sm', desc: 'text-xs' },
  md: { icon: 'h-6 w-6', box: 'h-14 w-14', title: 'text-base', desc: 'text-sm' },
  lg: { icon: 'h-8 w-8', box: 'h-16 w-16', title: 'text-lg', desc: 'text-sm' },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 px-6 py-12 text-center',
        className
      )}
    >
      <div
        className={cn(
          'mb-4 grid place-items-center rounded-full bg-muted text-muted-foreground',
          s.box
        )}
      >
        <Icon className={s.icon} />
      </div>
      <h3 className={cn('font-semibold text-foreground', s.title)}>{title}</h3>
      {description && (
        <p className={cn('mt-1.5 max-w-sm text-muted-foreground', s.desc)}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
