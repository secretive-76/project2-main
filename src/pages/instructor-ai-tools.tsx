import { useEffect, useState } from 'react';
import {
  Sparkles, Wand2, Copy, Check, RefreshCw, FileText,
  HelpCircle, BookOpen, Plus, Trash2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ToolType = 'quiz' | 'summary' | 'lesson-plan';

interface ToolConfig {
  id: ToolType;
  title: string;
  description: string;
  icon: typeof Sparkles;
  placeholder: string;
}

interface GeneratedQuestion {
  question: string;
  choices: string[];
  correct_choice: number;
  position: number;
}

interface CourseOption {
  id: string;
  title: string;
}

interface LessonOption {
  id: string;
  title: string;
  lesson_type: string;
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: LessonOption[];
}

// ---------------------------------------------------------------------------
// Tool catalogue
// ---------------------------------------------------------------------------
const aiTools: ToolConfig[] = [
  {
    id: 'quiz',
    title: 'Generate Quiz Questions',
    description: 'Create multiple-choice quiz questions using AI and publish them directly to a lesson.',
    icon: HelpCircle,
    placeholder: 'e.g. Focus on Multi-Head Attention, 5 questions, advanced difficulty',
  },
  {
    id: 'summary',
    title: 'Lecture Summary & Key Takeaways',
    description: 'Condense long transcripts or notes into clean, bulleted summaries and core takeaways.',
    icon: FileText,
    placeholder: 'Paste your raw lecture notes or transcript here...',
  },
  {
    id: 'lesson-plan',
    title: 'Interactive Lesson Plan',
    description: 'Generate structured lesson modules, student activities, and timed breakdowns.',
    icon: BookOpen,
    placeholder: 'e.g. Introduction to Next.js 14 App Router and Server Actions (90 mins)...',
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function InstructorAiToolsPage() {
  const [selectedTool, setSelectedTool] = useState<ToolType>('quiz');

  // Generic tool state (used by the mock panel — lesson-plan falls through here until LessonPlanWizard takes over)
  const [promptInput, setPromptInput] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [tone, setTone] = useState('Professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputResult, setOutputResult] = useState('');
  const [copied, setCopied] = useState(false);

  const activeToolConfig = aiTools.find((t) => t.id === selectedTool) ?? aiTools[0];

  // Generic mock generation for non-quiz tools
  const handleMockGenerate = () => {
    if (!promptInput.trim()) { toast.error('Please enter a topic or notes first.'); return; }
    setIsGenerating(true);
    setOutputResult('');
    setTimeout(() => {
      let out = '';
      if (selectedTool === 'summary') {
        out = `### Lecture Summary: ${promptInput}\n\n**Core Takeaways:**\n* Mastered core architecture patterns and data pipeline flows.\n* Handle edge cases with robust error handling and type safety.\n* Utilise memoization and asynchronous batching where applicable.`;
      } else {
        out = `### Lesson Plan: ${promptInput}\n\n* **Duration:** 90 Minutes\n* **Objective:** Understand and implement production-ready architecture.\n* **Outline:**\n  1. Introduction & Theory (20 mins)\n  2. Live Coding Demonstration (40 mins)\n  3. Q&A & Hands-on Exercise (30 mins)`;
      }
      setOutputResult(out);
      setIsGenerating(false);
      toast.success('AI content generated successfully!');
    }, 1200);
  };

  const handleCopy = () => {
    if (!outputResult) return;
    navigator.clipboard.writeText(outputResult);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Content Tools</h1>
          <Badge variant="outline" className="bg-indigo/10 text-indigo border-indigo/25 gap-1">
            <Sparkles className="h-3 w-3" /> Pro AI
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Generate quizzes, summaries, lesson plans, and project materials instantly with AI.
        </p>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {aiTools.map((tool) => {
          const Icon = tool.icon;
          const isSelected = selectedTool === tool.id;
          return (
            <Card
              key={tool.id}
              onClick={() => { setSelectedTool(tool.id); setOutputResult(''); setPromptInput(''); }}
              className={`cursor-pointer transition-all hover:border-indigo/50 ${isSelected ? 'border-indigo bg-indigo/5 ring-1 ring-indigo/50' : 'bg-card'}`}
            >
              <CardContent className="p-5 space-y-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-indigo text-indigo-foreground' : 'bg-muted text-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{tool.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tool-specific panels */}
      {selectedTool === 'quiz' ? (
        <QuizWizard />
      ) : selectedTool === 'summary' ? (
        <SummaryWizard />
      ) : selectedTool === 'lesson-plan' ? (
        <LessonPlanWizard />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input panel */}
          <Card className="lg:col-span-6 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-indigo" /> Configure {activeToolConfig.title}
              </CardTitle>
              <CardDescription>Provide details or notes to guide the AI generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Tone</label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professional">Professional</SelectItem>
                        <SelectItem value="Casual">Casual & Engaging</SelectItem>
                        <SelectItem value="Academic">Academic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Topic or Source Notes</label>
                  <Textarea placeholder={activeToolConfig.placeholder} value={promptInput} onChange={(e) => setPromptInput(e.target.value)} className="min-h-[160px] resize-none" />
                </div>
              </div>
              <Button onClick={handleMockGenerate} disabled={isGenerating} className="w-full gap-2 mt-6 bg-indigo hover:bg-indigo/90 text-indigo-foreground">
                {isGenerating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate with AI</>}
              </Button>
            </CardContent>
          </Card>

          {/* Output panel */}
          <Card className="lg:col-span-6 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">Generated Output</CardTitle>
                <CardDescription>Review, copy, or export your AI-generated material.</CardDescription>
              </div>
              {outputResult && (
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 rounded-xl border bg-muted/30 p-4 font-mono text-sm min-h-[260px] max-h-[380px] overflow-y-auto whitespace-pre-wrap">
                {isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-16">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo" />
                    <p className="text-sm font-sans">Synthesizing curriculum content…</p>
                  </div>
                ) : outputResult ? outputResult : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center py-16">
                    <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm">Configure your parameters and click <strong>Generate with AI</strong>.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizWizard — three-step flow for the quiz tool
//   Step 0: pick course → lesson, enter instructions, Generate
//   Step 1: review + edit generated questions, Publish
//   Step 2: success confirmation
// ---------------------------------------------------------------------------
type WizardStep = 0 | 1 | 2;

function QuizWizard() {
  // Step
  const [step, setStep] = useState<WizardStep>(0);

  // Step 0 state
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseModules, setCourseModules] = useState<ModuleWithLessons[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 1 state
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load instructor's courses on mount
  useEffect(() => {
    apiRequest('/instructor/courses')
      .then((data: { courses?: CourseOption[] }) => setCourses(data.courses ?? []))
      .catch(() => toast.error('Could not load your courses.'))
      .finally(() => setLoadingCourses(false));
  }, []);

  // Load lessons when a course is selected
  useEffect(() => {
    if (!selectedCourseId) { setCourseModules([]); setSelectedLessonId(''); return; }
    setLoadingLessons(true);
    setSelectedLessonId('');
    apiRequest(`/courses/${encodeURIComponent(selectedCourseId)}`)
      .then((data: { modules?: { id: string; title: string; lessons?: LessonOption[] }[] }) => {
        setCourseModules(
          (data.modules ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons ?? [],
          }))
        );
      })
      .catch(() => toast.error('Could not load lessons for this course.'))
      .finally(() => setLoadingLessons(false));
  }, [selectedCourseId]);

  const handleGenerate = async () => {
    if (!selectedLessonId) { toast.error('Select a lesson first.'); return; }
    setIsGenerating(true);
    try {
      const data = await apiRequest('/instructor/quiz/generate', {
        method: 'POST',
        body: JSON.stringify({ lesson_id: selectedLessonId, instructions }),
      }) as { questions: GeneratedQuestion[] };
      if (!data.questions?.length) throw new Error('No questions returned');
      // Stamp positions from their array index
      setQuestions(data.questions.map((q, i) => ({ ...q, position: i })));
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate questions.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!questions.length) return;
    // Validate every question has content
    const invalid = questions.find(
      (q) => !q.question.trim() || q.choices.some((c) => !c.trim()) ||
             q.correct_choice < 0 || q.correct_choice >= q.choices.length
    );
    if (invalid) { toast.error('Fix all questions before publishing.'); return; }

    setIsPublishing(true);
    try {
      await apiRequest('/instructor/quiz/save', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: selectedLessonId,
          questions: questions.map((q, i) => ({ ...q, position: i })),
        }),
      });
      setStep(2);
      toast.success('Quiz published to the lesson!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not publish quiz.');
    } finally {
      setIsPublishing(false);
    }
  };

  const reset = () => {
    setStep(0);
    setQuestions([]);
    setSelectedLessonId('');
    setSelectedCourseId('');
    setCourseModules([]);
    setInstructions('');
  };

  // ── Step 0: configure ────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-indigo" /> Configure Quiz Generation
            </CardTitle>
            <CardDescription>Pick the lesson and describe what you want.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 flex-1">
            {/* Course picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Course</Label>
              {loadingCourses ? (
                <p className="text-xs text-muted-foreground py-2">Loading courses…</p>
              ) : (
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Lesson picker — grouped by module */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Module › Lesson</Label>
              {loadingLessons ? (
                <p className="text-xs text-muted-foreground py-2">Loading modules and lessons…</p>
              ) : (
                <Select value={selectedLessonId} onValueChange={setSelectedLessonId} disabled={!selectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedCourseId ? 'Select a lesson' : 'Select a course first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {courseModules.map((mod) => (
                      <SelectGroup key={mod.id}>
                        <SelectLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                          {mod.title}
                        </SelectLabel>
                        {mod.lessons.length === 0 ? (
                          <SelectItem value={`__empty_${mod.id}`} disabled className="text-xs text-muted-foreground italic">
                            No lessons in this module
                          </SelectItem>
                        ) : (
                          mod.lessons.map((l) => (
                            <SelectItem key={l.id} value={l.id} className="pl-4">
                              {l.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    ))}
                    {courseModules.length === 0 && (
                      <div className="py-3 text-center text-xs text-muted-foreground">
                        No modules found for this course.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Instructions <span className="font-normal normal-case">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g. 5 MCQs focusing on attention heads, intermediate difficulty"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="resize-none min-h-[120px]"
              />
            </div>

            <Button
              onClick={() => void handleGenerate()}
              disabled={!selectedLessonId || isGenerating}
              className="w-full gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground"
            >
              {isGenerating
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
                : <><Sparkles className="h-4 w-4" /> Generate Questions</>}
            </Button>
          </CardContent>
        </Card>

        {/* Right: explainer */}
        <Card className="lg:col-span-6 flex flex-col justify-center bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo/10">
              <HelpCircle className="h-8 w-8 text-indigo" />
            </div>
            <div className="max-w-xs space-y-2">
              <h3 className="font-semibold text-foreground">How it works</h3>
              <p className="text-sm text-muted-foreground">
                Select a lesson — the AI reads its title and content to generate
                contextually accurate MCQs. You can review and edit every question
                before publishing directly to student quizzes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Step 2: success ───────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-foreground">Quiz Published!</h3>
            <p className="text-sm text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? 's' : ''} are now live for students in the selected lesson.
            </p>
          </div>
          <Button onClick={reset} className="mt-2 gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground">
            <Sparkles className="h-4 w-4" /> Generate Another Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Step 1: review + edit ─────────────────────────────────────────────────
  const updateQuestion = (idx: number, field: keyof GeneratedQuestion, value: string | string[] | number) => {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateChoice = (qIdx: number, cIdx: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const choices = [...q.choices];
      choices[cIdx] = value;
      return { ...q, choices };
    }));
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question: '', choices: ['', '', '', ''], correct_choice: 0, position: prev.length },
    ]);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Review & Edit — {questions.length} question{questions.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-muted-foreground">Edit any question or choice before publishing.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Start Over</Button>
          <Button size="sm" variant="outline" onClick={addQuestion} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Question
          </Button>
          <Button
            size="sm"
            onClick={() => void handlePublish()}
            disabled={isPublishing || !questions.length}
            className="gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground"
          >
            {isPublishing
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Publishing…</>
              : <><CheckCircle2 className="h-4 w-4" /> Publish Quiz</>}
          </Button>
        </div>
      </div>

      {/* Question cards */}
      <div className="space-y-4">
        {questions.map((q, qIdx) => (
          <Card key={qIdx} className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
              {/* Question text */}
              <div className="flex items-start gap-3">
                <span className="mt-2.5 shrink-0 text-xs font-bold text-muted-foreground w-6 text-right">
                  Q{qIdx + 1}
                </span>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Question</Label>
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                    placeholder="Enter question text"
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive mt-6 shrink-0"
                  onClick={() => removeQuestion(qIdx)}
                  disabled={questions.length <= 1}
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Choices grid */}
              <div className="pl-9 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.choices.map((choice, cIdx) => (
                  <div key={cIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuestion(qIdx, 'correct_choice', cIdx)}
                      className={`h-5 w-5 shrink-0 rounded-full border-2 transition-colors ${
                        q.correct_choice === cIdx
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-muted-foreground hover:border-primary'
                      }`}
                      aria-label={`Mark choice ${cIdx + 1} as correct`}
                    />
                    <Input
                      value={choice}
                      onChange={(e) => updateChoice(qIdx, cIdx, e.target.value)}
                      placeholder={`Choice ${cIdx + 1}`}
                      className={`text-xs h-8 ${q.correct_choice === cIdx ? 'border-emerald-500/60 bg-emerald-500/5' : ''}`}
                    />
                  </div>
                ))}
              </div>

              <p className="pl-9 text-[11px] text-muted-foreground">
                Click the circle next to a choice to mark it as correct.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom publish bar */}
      {questions.length > 0 && (
        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={reset}>Start Over</Button>
          <Button
            onClick={() => void handlePublish()}
            disabled={isPublishing}
            className="gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground"
          >
            {isPublishing
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Publishing…</>
              : <><CheckCircle2 className="h-4 w-4" /> Publish {questions.length} Question{questions.length !== 1 ? 's' : ''}</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryWizard
// Two-step flow for the Lecture Summary tool:
//   Step 0: course → lesson selector, difficulty/tone, optional extra notes → Generate
//   Step 1: rendered summary output with Copy button and Start Over
// ---------------------------------------------------------------------------
function SummaryWizard() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [tone, setTone] = useState('Professional');
  const [sourceNotes, setSourceNotes] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Result state
  const [summary, setSummary] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [copied, setCopied] = useState(false);

  // Load instructor courses on mount
  useEffect(() => {
    apiRequest('/instructor/courses')
      .then((data: { courses?: CourseOption[] }) => setCourses(data.courses ?? []))
      .catch(() => toast.error('Could not load your courses.'))
      .finally(() => setLoadingCourses(false));
  }, []);

  // Load lessons when course changes
  useEffect(() => {
    if (!selectedCourseId) { setLessons([]); setSelectedLessonId(''); return; }
    setLoadingLessons(true);
    setSelectedLessonId('');
    apiRequest(`/courses/${encodeURIComponent(selectedCourseId)}`)
      .then((data: { modules?: { lessons?: LessonOption[] }[] }) => {
        setLessons((data.modules ?? []).flatMap((m) => m.lessons ?? []));
      })
      .catch(() => toast.error('Could not load lessons for this course.'))
      .finally(() => setLoadingLessons(false));
  }, [selectedCourseId]);

  const handleGenerate = async () => {
    if (!selectedLessonId) { toast.error('Select a lesson first.'); return; }
    setIsGenerating(true);
    setSummary('');
    try {
      const data = await apiRequest('/instructor/ai/summary', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: selectedLessonId,
          difficulty,
          tone,
          source_notes: sourceNotes,
        }),
      }) as { summary: string; lesson_title: string };
      setSummary(data.summary ?? '');
      setLessonTitle(data.lesson_title ?? '');
      toast.success('Summary generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate summary.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setSummary('');
    setLessonTitle('');
    setSelectedLessonId('');
    setSelectedCourseId('');
    setSourceNotes('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ── Left: configuration panel ─────────────────────────────────────── */}
      <Card className="lg:col-span-5 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-indigo" /> Configure Summary
          </CardTitle>
          <CardDescription>Pick a lesson and set your preferences.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 flex-1">
          {/* Course picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Course</Label>
            {loadingCourses ? (
              <p className="text-xs text-muted-foreground py-2">Loading courses…</p>
            ) : (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Lesson picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Lesson</Label>
            {loadingLessons ? (
              <p className="text-xs text-muted-foreground py-2">Loading lessons…</p>
            ) : (
              <Select value={selectedLessonId} onValueChange={setSelectedLessonId} disabled={!selectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedCourseId ? 'Select a lesson' : 'Select a course first'} />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Difficulty + Tone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Casual">Casual & Engaging</SelectItem>
                  <SelectItem value="Academic">Academic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Supplementary notes */}
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Source Notes <span className="font-normal normal-case">(optional — paste transcript or talking points)</span>
            </Label>
            <Textarea
              placeholder="Paste raw lecture transcript, slide notes, or key points here…"
              value={sourceNotes}
              onChange={(e) => setSourceNotes(e.target.value)}
              className="resize-none min-h-[120px]"
            />
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={!selectedLessonId || isGenerating}
            className="w-full gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground"
          >
            {isGenerating
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
              : <><Sparkles className="h-4 w-4" /> Generate Summary</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Right: output panel ───────────────────────────────────────────── */}
      <Card className="lg:col-span-7 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">
              {lessonTitle ? `Summary — ${lessonTitle}` : 'Generated Summary'}
            </CardTitle>
            <CardDescription>
              Executive summary, key takeaways, and review questions.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> New
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border bg-muted/30 p-5 text-sm min-h-[360px] max-h-[520px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo" />
                <p className="font-sans">Synthesising lecture summary…</p>
              </div>
            ) : summary ? (
              summary
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center py-16 gap-3">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p>
                  Select a lesson on the left and click{' '}
                  <strong className="text-foreground">Generate Summary</strong> to create a
                  structured executive summary, key takeaways, and review questions.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonPlanWizard
// Mirrors SummaryWizard exactly but calls /api/instructor/ai/lesson-plan and
// displays a structured timed lesson plan instead of a lecture summary.
// ---------------------------------------------------------------------------
function LessonPlanWizard() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [tone, setTone] = useState('Professional');
  const [sourceNotes, setSourceNotes] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [plan, setPlan] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest('/instructor/courses')
      .then((data: { courses?: CourseOption[] }) => setCourses(data.courses ?? []))
      .catch(() => toast.error('Could not load your courses.'))
      .finally(() => setLoadingCourses(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) { setLessons([]); setSelectedLessonId(''); return; }
    setLoadingLessons(true);
    setSelectedLessonId('');
    apiRequest(`/courses/${encodeURIComponent(selectedCourseId)}`)
      .then((data: { modules?: { lessons?: LessonOption[] }[] }) => {
        setLessons((data.modules ?? []).flatMap((m) => m.lessons ?? []));
      })
      .catch(() => toast.error('Could not load lessons for this course.'))
      .finally(() => setLoadingLessons(false));
  }, [selectedCourseId]);

  const handleGenerate = async () => {
    if (!selectedLessonId) { toast.error('Select a lesson first.'); return; }
    setIsGenerating(true);
    setPlan('');
    try {
      const data = await apiRequest('/instructor/ai/lesson-plan', {
        method: 'POST',
        body: JSON.stringify({ lesson_id: selectedLessonId, difficulty, tone, source_notes: sourceNotes }),
      }) as { lesson_plan: string; lesson_title: string };
      setPlan(data.lesson_plan ?? '');
      setLessonTitle(data.lesson_title ?? '');
      toast.success('Lesson plan generated!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate lesson plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!plan) return;
    navigator.clipboard.writeText(plan);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => { setPlan(''); setLessonTitle(''); setSelectedLessonId(''); setSelectedCourseId(''); setSourceNotes(''); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ── Left: config panel ─────────────────────────────────────────────── */}
      <Card className="lg:col-span-5 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-indigo" /> Configure Lesson Plan
          </CardTitle>
          <CardDescription>Pick a lesson and set your delivery preferences.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 flex-1">
          {/* Course picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Course</Label>
            {loadingCourses ? <p className="text-xs text-muted-foreground py-2">Loading courses…</p> : (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Lesson picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Lesson</Label>
            {loadingLessons ? <p className="text-xs text-muted-foreground py-2">Loading lessons…</p> : (
              <Select value={selectedLessonId} onValueChange={setSelectedLessonId} disabled={!selectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedCourseId ? 'Select a lesson' : 'Select a course first'} />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Difficulty + Tone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Casual">Casual & Engaging</SelectItem>
                  <SelectItem value="Academic">Academic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source notes */}
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Topic / Source Notes <span className="font-normal normal-case">(optional)</span>
            </Label>
            <Textarea
              placeholder="e.g. 90-minute session, include a live-coding demo and breakout activity…"
              value={sourceNotes}
              onChange={(e) => setSourceNotes(e.target.value)}
              className="resize-none min-h-[120px]"
            />
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={!selectedLessonId || isGenerating}
            className="w-full gap-2 bg-indigo hover:bg-indigo/90 text-indigo-foreground"
          >
            {isGenerating
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
              : <><Sparkles className="h-4 w-4" /> Generate Lesson Plan</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Right: output panel ───────────────────────────────────────────── */}
      <Card className="lg:col-span-7 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg">
              {lessonTitle ? `Lesson Plan — ${lessonTitle}` : 'Generated Lesson Plan'}
            </CardTitle>
            <CardDescription>
              Objectives, timed outline, student activities, and assessment checkpoint.
            </CardDescription>
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> New
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border bg-muted/30 p-5 text-sm min-h-[360px] max-h-[520px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo" />
                <p className="font-sans">Building interactive lesson plan…</p>
              </div>
            ) : plan ? plan : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center py-16 gap-3">
                <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                <p>
                  Select a lesson and click{' '}
                  <strong className="text-foreground">Generate Lesson Plan</strong> to get a
                  timed outline, student activities, and assessment checkpoints.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
