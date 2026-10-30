import { useState } from 'react';
import {
  ListChecks,
  Clock,
  Star,
  Trophy,
  PlayCircle,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { quizzes } from '@/lib/practice-data';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Quiz } from '@/types';
import { saveQuizAttempt } from '@/lib/student-api';

const difficultyStyles: Record<string, string> = {
  Beginner: 'bg-success/10 text-success border-success/20',
  Intermediate: 'bg-info/10 text-info border-info/20',
  Advanced: 'bg-warning/10 text-warning border-warning/20',
};

export function QuizzesPage() {
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title="Quizzes"
        description="Test your knowledge with adaptive, AI-generated quizzes."
        actions={
          <Button size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4 text-teal" />
            Generate quiz
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryStat icon={ListChecks} label="Available" value={quizzes.length} accent="text-primary bg-primary/10" />
        <SummaryStat
          icon={Trophy}
          label="Completed"
          value={quizzes.filter((q) => q.attempts > 0).length}
          accent="text-success bg-success/10"
        />
        <SummaryStat
          icon={Target}
          label="Avg. score"
          value={`${Math.round(
            quizzes.filter((q) => q.attempts > 0).reduce((s, q) => s + q.bestScore, 0) /
              Math.max(1, quizzes.filter((q) => q.attempts > 0).length)
          )}%`}
          accent="text-info bg-info/10"
        />
        <SummaryStat
          icon={Star}
          label="Perfect scores"
          value={quizzes.filter((q) => q.bestScore === 100).length}
          accent="text-warning bg-warning/10"
        />
      </div>

      {/* Quiz list */}
      <div className="grid gap-4 lg:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} onStart={() => setActiveQuiz(quiz)} />
        ))}
      </div>

      {/* Quiz modal */}
      {activeQuiz && (
        <QuizRunner quiz={activeQuiz} onClose={() => setActiveQuiz(null)} />
      )}
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('grid h-10 w-10 place-items-center rounded-lg', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function QuizCard({ quiz, onStart }: { quiz: Quiz; onStart: () => void }) {
  const hasAttempted = quiz.attempts > 0;
  return (
    <Card className="group transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge className={cn('border-0', difficultyStyles[quiz.difficulty])}>{quiz.difficulty}</Badge>
              <Badge variant="secondary" className="text-xs">{quiz.category}</Badge>
            </div>
            <h3 className="mt-2 font-semibold text-foreground transition-colors group-hover:text-primary">
              {quiz.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            {quiz.questionCount} questions
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {quiz.estimatedMinutes} min
          </span>
          {hasAttempted && (
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-warning" />
              Best: {quiz.bestScore}%
            </span>
          )}
        </div>

        {hasAttempted && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Best score</span>
              <span className="font-medium text-foreground">{quiz.bestScore}%</span>
            </div>
            <Progress
              value={quiz.bestScore}
              className={cn('h-1.5', quiz.bestScore >= 80 ? '[&>div]:bg-success' : '[&>div]:bg-warning')}
            />
          </div>
        )}

        <Button onClick={onStart} size="sm" className="mt-4 w-full">
          {hasAttempted ? (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry quiz
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start quiz
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function QuizRunner({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(quiz.questions.length).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const question = quiz.questions[currentIdx];
  const isLast = currentIdx === quiz.questions.length - 1;
  const progress = ((currentIdx + (answered ? 1 : 0)) / quiz.questions.length) * 100;

  const score = answers.filter((a, i) => a === quiz.questions[i].correctIndex).length;
  const scorePercent = Math.round((score / quiz.questions.length) * 100);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    const newAnswers = [...answers];
    newAnswers[currentIdx] = selected;
    setAnswers(newAnswers);
    setAnswered(true);
  };

  const handleNext = () => {
    if (isLast) {
      setShowResult(true);
      saveQuizAttempt(quiz.id, scorePercent, quiz.questions.length, score).catch(() => toast.error('Quiz result could not be saved.'));
      if (scorePercent >= 80) {
        toast.success(`Quiz passed! Score: ${scorePercent}%`, {
          description: `You answered ${score} of ${quiz.questions.length} correctly.`,
        });
      } else {
        toast.warning(`Score: ${scorePercent}%`, {
          description: 'Review the explanations and try again.',
        });
      }
    } else {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      setSelected(answers[currentIdx - 1]);
      setAnswered(true);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setAnswers(Array(quiz.questions.length).fill(null));
    setShowResult(false);
    setSelected(null);
    setAnswered(false);
  };

  if (showResult) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Quiz Complete</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div
              className={cn(
                'grid h-20 w-20 place-items-center rounded-full',
                scorePercent >= 80 ? 'bg-success/10' : scorePercent >= 50 ? 'bg-warning/10' : 'bg-destructive/10'
              )}
            >
              {scorePercent >= 80 ? (
                <Trophy className="h-10 w-10 text-success" />
              ) : (
                <Target className="h-10 w-10 text-warning" />
              )}
            </div>
            <p className="mt-4 text-3xl font-bold text-foreground tabular-nums">{scorePercent}%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {score} of {quiz.questions.length} correct
            </p>
            <div className="mt-4 w-full">
              <Progress
                value={scorePercent}
                className={cn(
                  'h-2',
                  scorePercent >= 80 ? '[&>div]:bg-success' : scorePercent >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'
                )}
              />
            </div>
            <div className="mt-6 flex w-full gap-3">
              <Button onClick={handleRestart} variant="outline" className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button onClick={onClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{quiz.title}</DialogTitle>
            <span className="text-sm text-muted-foreground">
              {currentIdx + 1} / {quiz.questions.length}
            </span>
          </div>
        </DialogHeader>

        <div className="mt-2">
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-lg font-medium text-foreground">{question.question}</p>

          <div className="space-y-2">
            {question.options.map((option, idx) => {
              const isSelected = selected === idx;
              const isCorrect = idx === question.correctIndex;
              const showCorrect = answered && isCorrect;
              const showWrong = answered && isSelected && !isCorrect;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={answered}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-all',
                    !answered && isSelected && 'border-primary bg-primary/5',
                    !answered && !isSelected && 'border-border hover:border-primary/40 hover:bg-accent/50',
                    showCorrect && 'border-success bg-success/10',
                    showWrong && 'border-destructive bg-destructive/10',
                    answered && !showCorrect && !showWrong && 'border-border opacity-60'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-medium',
                      !answered && isSelected && 'border-primary bg-primary text-primary-foreground',
                      !answered && !isSelected && 'border-border text-muted-foreground',
                      showCorrect && 'border-success bg-success text-success-foreground',
                      showWrong && 'border-destructive bg-destructive text-destructive-foreground',
                      answered && !showCorrect && !showWrong && 'border-border text-muted-foreground'
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 text-foreground">{option}</span>
                  {showCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
                  {showWrong && <X className="h-5 w-5 shrink-0 text-destructive" />}
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Explanation</p>
              <p className="mt-1 text-sm text-muted-foreground">{question.explanation}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentIdx === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          {!answered ? (
            <Button size="sm" onClick={handleSubmit} disabled={selected === null}>
              Submit answer
            </Button>
          ) : (
            <Button size="sm" onClick={handleNext}>
              {isLast ? 'See results' : 'Next question'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
