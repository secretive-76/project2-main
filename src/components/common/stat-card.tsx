import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
  accent?: 'primary' | 'info' | 'warning' | 'success';
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
};

export function StatCard({ label, value, icon: Icon, trend, className, accent = 'primary' }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80', className)}>
      <div className="flex items-start justify-between">
        <div className={cn('grid h-10 w-10 place-items-center rounded-lg', accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.positive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
