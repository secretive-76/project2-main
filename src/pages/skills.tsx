import { useMemo } from 'react';
import { TrendingUp, Sparkles, ArrowUpRight, Target, BookOpen, Award } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getAllLessons, getDemoCompletedLessonIds, getStudentCourses } from '@/lib/course-utils';
import { useStudentPortalState } from '@/lib/student-api';
import { cn } from '@/lib/utils';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface CourseSkill {
  courseId: string;
  courseTitle: string;
  category: string;
  tags: string[];
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
}

function proficiencyColor(p: number): string {
  if (p >= 80) return 'bg-success';
  if (p >= 60) return 'bg-primary';
  if (p >= 40) return 'bg-warning';
  return 'bg-destructive';
}

function proficiencyLabel(p: number): string {
  if (p >= 80) return 'Expert';
  if (p >= 60) return 'Proficient';
  if (p >= 40) return 'Developing';
  return 'Beginner';
}

const categoryAccents: Record<string, string> = {
  'AI & ML': 'text-teal',
  'Data Science': 'text-info',
  'Web Development': 'text-primary',
  Math: 'text-warning',
  Languages: 'text-primary',
  Frameworks: 'text-indigo',
  Infrastructure: 'text-warning',
};

export function SkillsPage() {
  const { state } = useStudentPortalState();
  const enrolledCourses = getStudentCourses().filter((course) => course.status !== 'not-started');

  const courseSkills: CourseSkill[] = enrolledCourses.map((course) => {
    const allLessons = getAllLessons(course);
    const completedIds = new Set(state.completedLessonIds[course.id] ?? getDemoCompletedLessonIds(course.id));
    return {
      courseId: course.id,
      courseTitle: course.title,
      category: course.category,
      tags: course.tags,
      progress: allLessons.length ? Math.round((allLessons.filter((lesson) => completedIds.has(lesson.id)).length / allLessons.length) * 100) : 0,
      lessonsCompleted: allLessons.filter((lesson) => completedIds.has(lesson.id)).length,
      totalLessons: allLessons.length,
    };
  });

  const tagStats = useMemo(() => {
    const tagMap: Record<string, { totalProgress: number; count: number; courses: string[] }> = {};
    for (const cs of courseSkills) {
      for (const tag of cs.tags) {
        if (!tagMap[tag]) tagMap[tag] = { totalProgress: 0, count: 0, courses: [] };
        tagMap[tag].totalProgress += cs.progress;
        tagMap[tag].count += 1;
        tagMap[tag].courses.push(cs.courseTitle);
      }
    }
    return Object.entries(tagMap)
      .map(([tag, data]) => ({
        tag,
        avgProficiency: Math.round(data.totalProgress / data.count),
        courseCount: data.count,
        courses: data.courses,
      }))
      .sort((a, b) => b.avgProficiency - a.avgProficiency);
  }, [courseSkills]);

  const categoryStats = useMemo(() => {
    const catMap: Record<string, { totalProgress: number; count: number }> = {};
    for (const cs of courseSkills) {
      if (!catMap[cs.category]) catMap[cs.category] = { totalProgress: 0, count: 0 };
      catMap[cs.category].totalProgress += cs.progress;
      catMap[cs.category].count += 1;
    }
    return Object.entries(catMap).map(([category, data]) => ({
      category,
      proficiency: Math.round(data.totalProgress / data.count),
      courseCount: data.count,
    }));
  }, [courseSkills]);

  const avgProficiency = courseSkills.length > 0
    ? Math.round(courseSkills.reduce((s, c) => s + c.progress, 0) / courseSkills.length)
    : 0;

  const totalLessonsCompleted = courseSkills.reduce((s, c) => s + c.lessonsCompleted, 0);
  const totalLessons = courseSkills.reduce((s, c) => s + c.totalLessons, 0);

  const skillGaps = tagStats.filter((s) => s.avgProficiency < 60);

  const radarData = categoryStats;

  const barData = tagStats.slice(0, 8);

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Skills"
        description="Skill statistics computed from your enrolled courses and progress."
        actions={
          <Button size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4 text-teal" />
            Analyze gaps
          </Button>
        }
      />

      {/* Top: radar + overall stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Skill radar by course category</CardTitle>
            <CardDescription>Average course progress across domains</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  angle={90}
                />
                <Radar
                  dataKey="proficiency"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription>From your enrolled courses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Average course progress</p>
              <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">{avgProficiency}%</p>
              <Progress value={avgProficiency} className="mt-2 h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Enrolled courses</p>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{courseSkills.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Lessons done</p>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{totalLessonsCompleted}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Total lessons</p>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{totalLessons}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Skill gaps</p>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{skillGaps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill tags bar chart */}
      {barData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skill proficiency by tag</CardTitle>
            <CardDescription>Average progress across courses tagged with each skill</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tag" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.3 }}
                />
                <Bar dataKey="avgProficiency" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Course breakdown */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <BookOpen className="h-5 w-5 text-primary" />
          Course progress breakdown
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {courseSkills.map((cs) => (
            <Card key={cs.courseId}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{cs.courseTitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{cs.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {cs.lessonsCompleted}/{cs.totalLessons} lessons
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-foreground">{cs.progress}%</p>
                    <Badge variant="outline" className={cn('mt-1 text-[10px]', proficiencyColor(cs.progress), 'border-0 text-white')}>
                      {proficiencyLabel(cs.progress)}
                    </Badge>
                  </div>
                </div>
                <Progress value={cs.progress} className="h-2" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cs.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Skill gaps */}
      {skillGaps.length > 0 && (
        <Card className="border-warning/20 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-warning" />
              Skill gaps to address
            </CardTitle>
            <CardDescription>Skills where your course progress is below 60%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillGaps.map((skill) => (
              <div
                key={skill.tag}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{skill.tag}</p>
                    <span className="text-xs tabular-nums text-muted-foreground">{skill.avgProficiency}%</span>
                  </div>
                  <Progress value={skill.avgProficiency} className="mt-1.5 h-1.5" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    From {skill.courseCount} course{skill.courseCount > 1 ? 's' : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0">
                  Improve
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {courseSkills.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">No courses enrolled yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enroll in courses to see your skill statistics here.
            </p>
            <Button asChild className="mt-4" size="sm">
              <a href="/student/browse">Browse courses</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
