import { Link } from 'react-router-dom';
import {
  Route as RouteIcon,
  Sparkles,
  Clock,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Trophy,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { learningPaths } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export function LearningPathsPage() {
  const activePaths = learningPaths.filter((p) => p.status === 'active');
  const completedPaths = learningPaths.filter((p) => p.status === 'completed');

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Learning Paths"
        description="Structured journeys from beginner to expert, tailored by AI."
        actions={
          <Button size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4 text-teal" />
            Generate new path
          </Button>
        }
      />

      {/* AI banner */}
      <Card className="overflow-hidden border-teal/20 bg-gradient-to-br from-teal/5 via-card to-indigo/5">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal/10">
            <Sparkles className="h-6 w-6 text-teal" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">AI-curated for you</h3>
            <p className="text-sm text-muted-foreground">
              Learning paths are tailored to your current skills, goals, and pace. The AI adjusts the path as you progress.
            </p>
          </div>
          <Button size="sm" className="hidden sm:flex">
            <Sparkles className="mr-2 h-4 w-4" />
            Create path
          </Button>
        </CardContent>
      </Card>

      {/* Active paths */}
      {activePaths.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <RouteIcon className="h-5 w-5 text-primary" />
            In progress
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {activePaths.map((path) => (
              <PathCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      )}

      {/* Completed paths */}
      {completedPaths.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Trophy className="h-5 w-5 text-success" />
            Completed
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {completedPaths.map((path) => (
              <PathCard key={path.id} path={path} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PathCard({ path }: { path: typeof learningPaths[number] }) {
  const isCompleted = path.status === 'completed';
  return (
    <Card className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5">
      <div className="relative aspect-[16/7] overflow-hidden bg-muted">
        <img
          src={path.thumbnailUrl}
          alt={path.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {path.aiGenerated && (
          <Badge className="absolute left-3 top-3 gap-1 border-0 bg-teal/90 text-teal-foreground backdrop-blur">
            <Sparkles className="h-3 w-3" />
            AI-curated
          </Badge>
        )}
        {isCompleted && (
          <Badge className="absolute right-3 top-3 gap-1 border-0 bg-success/90 text-success-foreground backdrop-blur">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        )}
      </div>

      <CardContent className="p-5">
        <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
          {path.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{path.description}</p>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            {path.courseCount} courses
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {path.estimatedWeeks} weeks
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{path.progress}%</span>
          </div>
          <Progress value={path.progress} className={cn('h-2', isCompleted && '[&>div]:bg-success')} />
        </div>

        <Button asChild variant={isCompleted ? 'outline' : 'default'} size="sm" className="mt-4 w-full">
          <Link to={`/student/paths/${path.slug}`}>
            {isCompleted ? (
              <>
                <Trophy className="mr-2 h-4 w-4 text-success" />
                Review path
              </>
            ) : (
              <>
                Continue path
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
