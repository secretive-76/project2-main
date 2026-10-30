import { useState, useMemo } from 'react';
import {
  FlaskConical,
  Search,
  Clock,
  PlayCircle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { labs } from '@/lib/practice-data';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Lab } from '@/types';

type FilterKey = 'all' | 'not-started' | 'in-progress' | 'completed';

const difficultyStyles: Record<string, string> = {
  Beginner: 'bg-success/10 text-success border-success/20',
  Intermediate: 'bg-info/10 text-info border-info/20',
  Advanced: 'bg-warning/10 text-warning border-warning/20',
};

const statusConfig = {
  'not-started': { label: 'Not started', icon: Circle, class: 'text-muted-foreground' },
  'in-progress': { label: 'In progress', icon: PlayCircle, class: 'text-info' },
  completed: { label: 'Completed', icon: CheckCircle2, class: 'text-success' },
};

const categories = ['All', 'AI & ML', 'Data Science', 'Web Development'];

export function LabsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return labs.filter((lab) => {
      if (filter !== 'all' && lab.status !== filter) return false;
      if (category !== 'All' && lab.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          lab.title.toLowerCase().includes(q) ||
          lab.techStack.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [filter, category, search]);

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Labs"
        description="Hands-on coding environments right in your browser."
        actions={
          <Button size="sm" variant="outline">
            <Terminal className="mr-2 h-4 w-4" />
            Open sandbox
          </Button>
        }
      />

      {/* Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="in-progress">In progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="not-started">Available</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                category === cat
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search labs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lab grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lab) => (
            <LabCard key={lab.id} lab={lab} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
            <FlaskConical className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No labs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters or search.</p>
        </div>
      )}
    </div>
  );
}

function LabCard({ lab }: { lab: Lab }) {
  const status = statusConfig[lab.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={lab.thumbnailUrl}
          alt={lab.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge className={cn('border-0', difficultyStyles[lab.difficulty])}>{lab.difficulty}</Badge>
        </div>
        <div
          className={cn(
            'absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur',
            status.class
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-muted-foreground">{lab.category}</p>
        <h3 className="mt-1 line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
          {lab.title}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{lab.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {lab.techStack.map((tech) => (
            <Badge key={tech} variant="secondary" className="text-[10px] font-medium">
              {tech}
            </Badge>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(lab.estimatedMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <FlaskConical className="h-3.5 w-3.5" />
            {lab.skills.length} skills
          </span>
        </div>

        {lab.status === 'in-progress' && (
          <div className="mt-3">
            <Progress value={lab.progress} className="h-1.5" />
          </div>
        )}

        <Button
          variant={lab.status === 'completed' ? 'outline' : 'default'}
          size="sm"
          className="mt-4 w-full"
        >
          {lab.status === 'completed' ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
              Review lab
            </>
          ) : lab.status === 'in-progress' ? (
            <>
              Resume lab
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Start lab
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
