import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Grid,
  LayoutGrid,
  X,
  Star,
  Clock,
  Users,
  GraduationCap,
  Compass,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { CourseCard } from '@/components/common/course-card';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber, formatDuration, initials } from '@/lib/format';
import type { Course, Difficulty } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getImageUrl } from '@/lib/api';

const API_BASE = 'http://localhost:8081';

interface ActiveCourseApiItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url: string;
  status: string;
  instructor?: { id: number; name: string } | { name: string };
}

function mapApiCourse(course: ActiveCourseApiItem): Course {
  return {
    id: course.id,
    slug: course.slug || course.id,
    title: course.title,
    subtitle: course.description || 'Live course from the Akademia platform.',
    description: course.description || 'No description provided.',
    category: course.category || 'General',
    difficulty: (course.difficulty as Difficulty) || 'Beginner',
    thumbnailUrl: getImageUrl(course.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
    rating: 5,
    reviews: 0,
    enrolled: 0,
    durationHours: 1,
    instructor: {
      id: String((course.instructor as { id?: number } | undefined)?.id ?? course.id),
      name: (course.instructor as { name?: string } | undefined)?.name ?? 'Akademia Instructor',
      title: 'Instructor',
      avatarUrl: '',
      rating: 5,
      students: 0,
    },
    tags: [],
    modules: [],
    status: 'not-started',
    progress: 0,
  };
}

const categories = ['All', 'AI & ML', 'Data Science', 'Web Development'];
const difficulties: (Difficulty | 'All')[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const sortOptions = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'shortest', label: 'Shortest first' },
  { value: 'newest', label: 'Newest' },
] as const;

type SortValue = (typeof sortOptions)[number]['value'];

export function CatalogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState<Difficulty | 'All'>('All');
  const [sort, setSort] = useState<SortValue>('popular');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const refreshCourses = async (showError = false) => {
    try {
      setCatalogError('');
      const token = localStorage.getItem('akademia-token');
      const response = await fetch(`${API_BASE}/api/courses`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load courses');
      const activeCourses = Array.isArray(data.courses)
        ? data.courses
            .filter((course: ActiveCourseApiItem) => course.status === 'approved')
            .map(mapApiCourse)
        : [];
      setCourses(activeCourses);
      sessionStorage.setItem('akademia-course-previews', JSON.stringify(activeCourses));
    } catch (error) {
      // Keep the last successful catalog on screen if a temporary request fails.
      // Clearing it made approved instructor courses appear to randomly disappear.
      const message = error instanceof Error ? error.message : 'Could not load catalog';
      setCatalogError(message);
      if (showError) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCourses(true);
    // Refresh in the background for a newly approved instructor course, without
    // wiping the list if the backend is momentarily unavailable.
    const timer = window.setInterval(() => { void refreshCourses(false); }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    let list = courses.filter((c) => {
      const matchesQuery =
        !query ||
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()));
      const matchesCategory = category === 'All' || c.category === category;
      const matchesDifficulty = difficulty === 'All' || c.difficulty === difficulty;
      return matchesQuery && matchesCategory && matchesDifficulty;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'rating':
          return b.rating - a.rating;
        case 'shortest':
          return a.durationHours - b.durationHours;
        case 'newest':
          return b.id.localeCompare(a.id);
        default:
          return b.enrolled - a.enrolled;
      }
    });

    return list;
  }, [courses, query, category, difficulty, sort]);

  const activeFilters =
    (category !== 'All' ? 1 : 0) + (difficulty !== 'All' ? 1 : 0) + (query ? 1 : 0);

  const clearAll = () => {
    setQuery('');
    setCategory('All');
    setDifficulty('All');
  };

  return (
    <div className="space-y-6 animate-in-slide">
      <PageHeader
        title="Course Catalog"
        description="Explore AI-curated courses across AI, data science, and web development."
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            {loading ? 'Loading…' : `${courses.length} active courses`}
          </Badge>
        }
      />

      {/* Search + sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses, topics, or skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortValue)}>
          <SelectTrigger className="w-full sm:w-44">
            <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter chips */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                category === cat
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Level:</span>
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                difficulty === d
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter summary */}
      {activeFilters > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of{' '}
            {courses.length} courses
          </p>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        </div>
      )}

      {catalogError && courses.length > 0 ? (
        <p className="text-sm text-muted-foreground">Showing the last loaded catalog. It will refresh automatically when the server reconnects.</p>
      ) : null}

      {/* Results */}
      {!loading && filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No active courses found"
          description="Approved courses will appear here automatically once an instructor publishes them and an admin approves them."
          action={
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear all filters
            </Button>
          }
          size="lg"
        />
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">Loading active catalog…</CardContent>
        </Card>
      ) : null}

      {/* Featured spotlight */}
      {filtered.length > 0 && (
        <Card className="mt-8 overflow-hidden border-primary/20">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[2fr_1fr] lg:p-8">
            <div>
              <Badge className="mb-3 gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                <Star className="h-3 w-3 fill-primary" />
                Editor's pick
              </Badge>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {courses[0].title}
              </h3>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                {courses[0].description}
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={courses[0].instructor.avatarUrl} alt={courses[0].instructor.name} />
                    <AvatarFallback className="text-xs">{initials(courses[0].instructor.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium text-foreground">{courses[0].instructor.name}</p>
                    <p className="text-xs text-muted-foreground">{courses[0].instructor.title}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="font-medium text-foreground">{courses[0].rating}</span>
                  <span>({formatNumber(courses[0].reviews)})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {formatNumber(courses[0].enrolled)} enrolled
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDuration(courses[0].durationHours * 60)}
                </span>
              </div>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-lg lg:aspect-auto">
              <img
                src={courses[0].thumbnailUrl}
                alt={courses[0].title}
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
