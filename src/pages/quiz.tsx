import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, ListChecks, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { loadStudentQuiz, submitStudentQuiz, type StudentQuizQuestion, type StudentQuizResult } from '@/lib/student-api';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type QuizMode = 'overview' | 'exam' | 'results';

export function QuizPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const [questions, setQuestions] = useState<StudentQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [mode, setMode] = useState<QuizMode>('overview');
  const [result, setResult] = useState<StudentQuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    void loadStudentQuiz(lessonId)
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions);
        setAnswers(data.questions.map(() => -1));
        setSecondsLeft(data.time_limit_seconds || data.time_limit_minutes * 60 || 600);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load quiz'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lessonId]);

  const submit = async () => {
    if (!lessonId || submitting || mode !== 'exam') return;
    setSubmitting(true);
    try {
      const submission = await submitStudentQuiz(lessonId, answers);
      setResult(submission);
      setMode('results');
      toast.success('Quiz submitted successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (mode !== 'exam' || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [mode, secondsLeft]);

  useEffect(() => {
    if (mode === 'exam' && secondsLeft === 0) void submit();
  }, [mode, secondsLeft]);

  if (!slug || !lessonId) return <Navigate to="/student/browse" replace />;
  if (loading) return <div className="mx-auto max-w-4xl p-8 text-muted-foreground">Loading quiz…</div>;
  if (!questions.length) return <div className="mx-auto max-w-4xl p-8"><div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">No quiz questions have been added yet.</div></div>;

  const totalMarks = questions.length;
  const backHref = `/student/courses/${slug}`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to course
        </Link>

        {mode === 'overview' && (
          <section className="rounded-2xl border border-info/20 bg-card p-6 shadow-sm sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-info/10 text-info"><ListChecks className="h-7 w-7" /></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-info">Quiz overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Ready for {questions.length} questions?</h1>
              <p className="mt-3 text-muted-foreground">You will have a single timed attempt. Review your answers before submitting.</p>
              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                <SummaryItem label="Questions" value={String(questions.length)} />
                <SummaryItem label="Total marks" value={String(totalMarks)} />
                <SummaryItem label="Time limit" value={`${Math.ceil(secondsLeft / 60)} min`} />
              </div>
              <Button size="lg" className="mt-8 w-full sm:w-auto" onClick={() => setMode('exam')}>
                <PlayCircle className="mr-2 h-5 w-5" /> Take Quiz
              </Button>
            </div>
          </section>
        )}

        {mode === 'exam' && (
          <section className="space-y-5">
            <div className="sticky top-3 z-10 flex items-center justify-between gap-4 rounded-xl border border-border bg-card/95 p-4 shadow-sm backdrop-blur">
              <div><p className="text-sm font-semibold text-foreground">{questions.length} questions</p><p className="text-xs text-muted-foreground">Select one answer for each question</p></div>
              <Badge variant={secondsLeft <= 30 ? 'destructive' : 'secondary'} className="gap-1.5 px-3 py-1.5 text-lg font-bold tracking-wide text-emerald-300"><Clock3 className="h-5 w-5" /> Time Left: {formatTime(secondsLeft)}</Badge>
            </div>
            {questions.map((question, questionIndex) => (
              <div key={question.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <p className="text-base font-semibold text-foreground">{questionIndex + 1}. {question.question}</p>
                <div className="mt-4 grid gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <button key={`${question.id}-${choiceIndex}`} type="button" onClick={() => setAnswers((current) => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} className={cn('rounded-lg border p-3 text-left text-sm transition-colors', answers[questionIndex] === choiceIndex ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted')}>
                      {String.fromCharCode(65 + choiceIndex)}. {choice}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button size="lg" className="w-full" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Quiz'}</Button>
          </section>
        )}

        {mode === 'results' && result && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-success/20 bg-success/5 p-6 text-center sm:p-10">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-success">Quiz complete</p>
              <h1 className="mt-2 text-4xl font-bold text-foreground">{result.score}%</h1>
              <p className="mt-2 text-muted-foreground">{result.correct_answers} of {result.total_questions} marks</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Answer breakdown</h2>
              <div className="mt-4 space-y-4">
                {questions.map((question, questionIndex) => {
                  const correctChoice = result.correct_choices.find((item) => item.question_id === question.id)?.correct_choice;
                  const selectedChoice = answers[questionIndex];
                  return <div key={question.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                    <p className="font-medium text-foreground">{questionIndex + 1}. {question.question}</p>
                    <div className="mt-2 grid gap-2">
                      {question.choices.map((choice, choiceIndex) => <div key={`${question.id}-result-${choiceIndex}`} className={cn('rounded-md border p-2 text-sm', choiceIndex === correctChoice ? 'border-success/50 bg-success/10 text-success' : choiceIndex === selectedChoice ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border text-muted-foreground')}>
                        {String.fromCharCode(65 + choiceIndex)}. {choice}{choiceIndex === correctChoice ? ' · Correct answer' : choiceIndex === selectedChoice ? ' · Your answer' : ''}
                      </div>)}
                    </div>
                  </div>;
                })}
              </div>
            </div>
            <Button variant="outline" asChild><Link to={backHref}>Return to course</Link></Button>
          </section>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></div>;
}
