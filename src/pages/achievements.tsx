import {
  Flame,
  Brain,
  Footprints,
  Zap,
  FlaskConical,
  Languages,
  Moon,
  GraduationCap,
  HeartHandshake,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { extendedAchievements } from '@/lib/practice-data';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/types';
import { useEffect, useMemo, useState } from 'react';
import { loadLearningSummary, type LearningSummary, useStudentPortalState } from '@/lib/student-api';

const iconMap: Record<string, LucideIcon> = {
  Flame,
  Brain,
  Footprints,
  Zap,
  FlaskConical,
  Languages,
  Moon,
  GraduationCap,
  HeartHandshake,
  Rocket,
  Sparkles,
  Target,
};

const rarityConfig: Record<
  Achievement['rarity'],
  { label: string; gradient: string; ring: string; badge: string; glow: string }
> = {
  common: {
    label: 'Common',
    gradient: 'from-muted to-muted/50',
    ring: 'border-border',
    badge: 'bg-muted text-muted-foreground border-border',
    glow: '',
  },
  rare: {
    label: 'Rare',
    gradient: 'from-info/20 to-primary/20',
    ring: 'border-info/30',
    badge: 'bg-info/10 text-info border-info/20',
    glow: 'shadow-info/10',
  },
  epic: {
    label: 'Epic',
    gradient: 'from-indigo/20 to-teal/20',
    ring: 'border-indigo/30',
    badge: 'bg-indigo/10 text-indigo border-indigo/20',
    glow: 'shadow-indigo/10',
  },
  legendary: {
    label: 'Legendary',
    gradient: 'from-warning/20 to-destructive/20',
    ring: 'border-warning/40',
    badge: 'bg-warning/10 text-warning border-warning/20',
    glow: 'shadow-warning/20',
  },
};

export function AchievementsPage() {
  const { state } = useStudentPortalState();
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  useEffect(() => { loadLearningSummary().then(setSummary).catch(() => undefined); }, [state]);
  const liveAchievements = useMemo(() => {
    if (!summary) return extendedAchievements.map((achievement) => ({ ...achievement, unlockedAt: null }));
    const now = new Date().toISOString();
    const rules: Record<string, boolean> = {
      a_2: summary.quizzes_90_plus >= 50,
      a_3: summary.courses_completed >= 1,
      a_4: summary.current_streak >= 20,
      a_12: summary.perfect_quizzes >= 10,
    };
    return extendedAchievements.map((achievement) => ({ ...achievement, unlockedAt: rules[achievement.id] ? now : null }));
  }, [summary]);
  const unlocked = liveAchievements.filter((a) => a.unlockedAt !== null);
  const locked = liveAchievements.filter((a) => a.unlockedAt === null);
  const total = liveAchievements.length;
  const unlockPercent = Math.round((unlocked.length / total) * 100);

  const byRarity = {
    legendary: liveAchievements.filter((a) => a.rarity === 'legendary'),
    epic: liveAchievements.filter((a) => a.rarity === 'epic'),
    rare: liveAchievements.filter((a) => a.rarity === 'rare'),
    common: liveAchievements.filter((a) => a.rarity === 'common'),
  };

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Achievements"
        description="Celebrate milestones and track your learning accomplishments."
      />

      {/* Overall progress banner */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-warning/20 to-destructive/20">
            <Trophy className="h-7 w-7 text-warning" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Achievement progress</h3>
              <span className="text-sm font-medium text-foreground">
                {unlocked.length} / {total} unlocked
              </span>
            </div>
            <Progress value={unlockPercent} className="mt-2 h-2" />
          </div>
          <div className="flex gap-2">
            {(['legendary', 'epic', 'rare', 'common'] as const).map((rarity) => {
              const cfg = rarityConfig[rarity];
              const count = byRarity[rarity].length;
              const unlockedCount = byRarity[rarity].filter((a) => a.unlockedAt).length;
              return (
                <div key={rarity} className={cn('rounded-lg border px-3 py-2 text-center', cfg.badge)}>
                  <p className="text-lg font-bold tabular-nums">{unlockedCount}/{count}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unlocked achievements */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Trophy className="h-5 w-5 text-warning" />
          Unlocked ({unlocked.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {unlocked.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </section>

      {/* Locked achievements */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lock className="h-5 w-5 text-muted-foreground" />
          Locked ({locked.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {locked.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = iconMap[achievement.icon] ?? Trophy;
  const isUnlocked = achievement.unlockedAt !== null;
  const cfg = rarityConfig[achievement.rarity];

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all',
        isUnlocked && 'hover:-translate-y-0.5 hover:shadow-lg',
        isUnlocked && cfg.glow && `hover:shadow-lg ${cfg.glow}`,
        !isUnlocked && 'opacity-70'
      )}
    >
      <div
        className={cn(
          'relative flex flex-col items-center p-5 text-center',
          isUnlocked && `bg-gradient-to-b ${cfg.gradient}`,
          !isUnlocked && 'bg-muted/30'
        )}
      >
        <div
          className={cn(
            'grid h-16 w-16 place-items-center rounded-2xl border-2 transition-transform',
            cfg.ring,
            isUnlocked ? 'bg-card group-hover:scale-110' : 'bg-muted/50',
            isUnlocked && achievement.rarity === 'legendary' && 'shadow-lg shadow-warning/20'
          )}
        >
          {isUnlocked ? (
            <Icon
              className={cn(
                'h-8 w-8',
                achievement.rarity === 'legendary' && 'text-warning',
                achievement.rarity === 'epic' && 'text-indigo',
                achievement.rarity === 'rare' && 'text-info',
                achievement.rarity === 'common' && 'text-muted-foreground'
              )}
            />
          ) : (
            <Lock className="h-7 w-7 text-muted-foreground/50" />
          )}
        </div>

        <h3 className="mt-3 font-semibold text-foreground">{achievement.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{achievement.description}</p>

        <Badge variant="outline" className={cn('mt-3 text-[10px]', cfg.badge)}>
          {cfg.label}
        </Badge>

        {isUnlocked && (
          <p className="mt-2 text-[11px] text-muted-foreground">Verified from your saved learning activity</p>
        )}
      </div>
    </Card>
  );
}
