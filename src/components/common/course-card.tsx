import { Link } from 'react-router-dom';
import { Clock, Star, PlayCircle, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import type { Course } from '@/types';
import { formatNumber, formatDuration, initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';

const difficultyStyles: Record<Course['difficulty'], string> = {
  Beginner: 'bg-success/10 text-success border-success/20',
  Intermediate: 'bg-info/10 text-info border-info/20',
  Advanced: 'bg-warning/10 text-warning border-warning/20',
};

const statusConfig = {
  'not-started': { label: 'Not started', icon: Circle, class: 'text-muted-foreground' },
  'in-progress': { label: 'In progress', icon: PlayCircle, class: 'text-info' },
  completed: { label: 'Completed', icon: CheckCircle2, class: 'text-success' },
};

export function CourseCard({ course }: { course: Course }) {
  const status = statusConfig[course.status];
  const StatusIcon = status.icon;

  const content = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img src={getImageUrl(course.thumbnailUrl)} alt={course.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2"><Badge variant="secondary" className="border-0 bg-background/90 backdrop-blur">{course.category}</Badge><Badge className={cn('border-0', difficultyStyles[course.difficulty])}>{course.difficulty}</Badge></div>
        <div className={cn('absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur', status.class)}><StatusIcon className="h-3.5 w-3.5" />{course.provider ?? status.label}</div>
      </div>
      <div className="flex flex-1 flex-col p-4"><h3 className="line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">{course.title}</h3><p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{course.subtitle}</p><div className="mt-3 flex items-center gap-2.5"><Avatar className="h-6 w-6"><AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.name} /><AvatarFallback className="text-[10px]">{initials(course.instructor.name)}</AvatarFallback></Avatar><span className="truncate text-xs text-muted-foreground">{course.instructor.name}</span></div><div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" /><span className="font-medium text-foreground">{course.rating}</span></span><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{course.externalUrl ? 'Open provider course' : formatDuration(course.durationHours * 60)}</span></div></div>
    </>
  );
  if (course.externalUrl) return <a href={course.externalUrl} target="_blank" rel="noreferrer" className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5">{content}</a>;
  return (
    <Link
      to={`/student/courses/${course.slug || course.id}`}
      state={{ coursePreview: course }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={getImageUrl(course.thumbnailUrl)}
          alt={course.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant="secondary" className="border-0 bg-background/90 backdrop-blur">
            {course.category}
          </Badge>
          <Badge className={cn('border-0', difficultyStyles[course.difficulty])}>
            {course.difficulty}
          </Badge>
        </div>
        <div className={cn('absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur', status.class)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {course.subtitle}
        </p>

        <div className="mt-3 flex items-center gap-2.5">
          <Avatar className="h-6 w-6">
            <AvatarImage src={course.instructor.avatarUrl} alt={course.instructor.name} />
            <AvatarFallback className="text-[10px]">{initials(course.instructor.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">
            {course.instructor.name}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <span className="font-medium text-foreground">{course.rating}</span>
            <span>({formatNumber(course.reviews)})</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(course.durationHours * 60)}
          </span>
        </div>

        {course.status === 'in-progress' && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-1.5" />
          </div>
        )}
      </div>
    </Link>
  );
}
