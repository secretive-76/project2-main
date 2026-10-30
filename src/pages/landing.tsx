import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Brain,
  Route,
  Trophy,
  MessageSquare,
  Zap,
  Target,
  CheckCircle2,
  Star,
  Play,
  GraduationCap,
  Compass,
  TrendingUp,
} from 'lucide-react';
import { MarketingNavbar } from '@/components/layout/marketing-navbar';
import { MarketingFooter } from '@/components/layout/marketing-footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { courses, instructors } from '@/lib/mock-data';
import { formatNumber, initials } from '@/lib/format';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 lg:px-8 lg:pb-32 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 gap-1.5 border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered learning, reimagined
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Learn anything with an{' '}
              <span className="text-gradient-brand">AI coach</span> that adapts to you
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              Akademia combines world-class courses with a personal AI tutor that tracks your
              progress, finds your gaps, and builds a path that fits how you actually learn.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/signup">
                  Start learning free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/student/browse">
                  <Play className="mr-2 h-4 w-4" />
                  Browse courses
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required &middot; 120K+ learners worldwide
            </p>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border shadow-2xl shadow-foreground/10">
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-destructive/60" />
                  <span className="h-3 w-3 rounded-full bg-warning/60" />
                  <span className="h-3 w-3 rounded-full bg-success/60" />
                </div>
                <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  akademia.ai/coach
                </div>
              </div>
              <div className="bg-card p-6 lg:p-8">
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                        <Brain className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 rounded-xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
                        Can you explain why my transformer's loss plateaus after epoch 3?
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2 rounded-xl rounded-tl-sm border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                        <p>
                          Your loss plateaus because your learning rate is too high after the
                          warmup phase. I see two fixes in your code:
                        </p>
                        <p>1. Add a cosine decay schedule starting at epoch 3</p>
                        <p>2. Reduce batch size from 64 → 32 for more gradient updates</p>
                        <p className="pt-1 text-primary">
                          Want me to generate a patched training script? →
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Your progress
                    </p>
                    {[
                      ['Attention', 100],
                      ['Transformers', 64],
                      ['Training', 28],
                    ].map(([label, pct]) => (
                      <div key={label as string}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-foreground">{label}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-lg bg-success/5 px-2.5 py-2 text-xs text-success">
                      <Trophy className="h-3.5 w-3.5" />
                      23-day streak
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust bar */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60">
            {['Hugging Face', 'Vercel', 'DeepMind', 'OpenAI', 'Stanford'].map((brand) => (
              <span key={brand} className="text-sm font-semibold tracking-tight text-muted-foreground">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Why Akademia</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Everything you need to actually learn
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Not just video lectures. A complete system that adapts, tracks, and coaches.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5">
                <CardContent className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured courses */}
      <section id="courses" className="border-t border-border bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Badge variant="secondary" className="mb-4">Featured courses</Badge>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Taught by world-class experts
              </h2>
            </div>
            <Button variant="outline" asChild>
              <Link to="/student/browse">
                Browse all courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {courses.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                to="/student/browse"
                className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <Badge className="absolute left-3 top-3 border-0 bg-background/90 backdrop-blur">
                    {c.category}
                  </Badge>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-semibold text-foreground group-hover:text-primary">
                    {c.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.subtitle}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={c.instructor.avatarUrl} alt={c.instructor.name} />
                      <AvatarFallback className="text-[8px]">{initials(c.instructor.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs text-muted-foreground">{c.instructor.name}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="font-medium text-foreground">{c.rating}</span>
                    </span>
                    <span>{formatNumber(c.enrolled)} enrolled</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">How it works</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              From zero to mastery in three steps
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute left-[3.25rem] top-7 hidden h-px w-[calc(100%-3rem)] bg-border md:block" />
                )}
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border bg-card text-lg font-semibold text-primary shadow-sm">
                    {i + 1}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instructors */}
      <section className="border-t border-border bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Learn from the best</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Instructors who've built the tools you'll use
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(instructors).map((inst) => (
              <Card key={inst.id}>
                <CardContent className="flex items-center gap-4 p-6">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={inst.avatarUrl} alt={inst.name} />
                    <AvatarFallback>{initials(inst.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{inst.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">{inst.title}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {inst.rating}
                      </span>
                      <span>{formatNumber(inst.students)} students</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade when you're ready for unlimited AI coaching.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                className={tier.featured ? 'relative border-primary shadow-lg shadow-primary/10' : ''}
              >
                {tier.featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Most popular
                  </Badge>
                )}
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-foreground">
                      {tier.price}
                    </span>
                    {tier.price !== 'Free' && (
                      <span className="text-sm text-muted-foreground">/month</span>
                    )}
                  </div>
                  <Button
                    className="mt-6 w-full"
                    variant={tier.featured ? 'default' : 'outline'}
                    asChild
                  >
                    <Link to="/signup">{tier.cta}</Link>
                  </Button>
                  <ul className="mt-6 space-y-3">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-foreground px-6 py-16 text-center lg:px-16 lg:py-24">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="relative">
              <Sparkles className="mx-auto mb-6 h-10 w-10 text-primary" />
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-background sm:text-4xl">
                Your AI learning journey starts today
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-balance text-background/70">
                Join 120,000+ learners who've leveled up with Akademia. Free to start, no credit
                card required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/signup">
                    Create your free account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

const features = [
  {
    icon: Sparkles,
    title: 'Personal AI Coach',
    description:
      'Ask questions, get explanations, and debug your code with an AI that knows your learning history and gaps.',
  },
  {
    icon: Route,
    title: 'Adaptive Learning Paths',
    description:
      'AI builds a custom path from your current skills to your goal — and re-routes when you struggle.',
  },
  {
    icon: Target,
    title: 'Gap Detection',
    description:
      'Akademia finds the concepts you skipped and fills them in before they block your progress.',
  },
  {
    icon: Trophy,
    title: 'Achievements & Streaks',
    description:
      'Stay motivated with streaks, skill points, and achievements that map to real-world mastery.',
  },
  {
    icon: MessageSquare,
    title: 'Practice Interviews',
    description:
      'Run mock technical interviews with your AI coach across ML, systems, and frontend tracks.',
  },
  {
    icon: TrendingUp,
    title: 'Skill Tracking',
    description:
      'Watch your skill graph grow. Every lesson and quiz updates your proficiency in real time.',
  },
];

const steps = [
  {
    title: 'Tell Akademia your goal',
    description:
      'Share what you want to learn — from "build an LLM app" to "pass my ML interview." Akademia maps the path.',
  },
  {
    title: 'Learn with your AI coach',
    description:
      'Watch lessons, run labs, and chat with your coach anytime. It adapts to your pace and pinpoints gaps.',
  },
  {
    title: 'Track & prove mastery',
    description:
      'Earn skill points, unlock achievements, and build a portfolio that shows what you can actually do.',
  },
];

const pricingTiers = [
  {
    name: 'Free',
    description: 'Perfect for getting started',
    price: 'Free',
    cta: 'Start free',
    features: [
      'Access to 20+ intro courses',
      '5 AI coach messages / day',
      'Community support',
      'Basic progress tracking',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    description: 'For serious learners',
    price: '$24',
    cta: 'Get Pro',
    features: [
      'Unlimited course access',
      'Unlimited AI coaching',
      'Adaptive learning paths',
      'Hands-on labs & quizzes',
      'Skill tracking & analytics',
      'Mock interviews',
    ],
    featured: true,
  },
  {
    name: 'Team',
    description: 'For teams & organizations',
    price: '$49',
    cta: 'Contact sales',
    features: [
      'Everything in Pro',
      'Team dashboards',
      'Custom learning paths',
      'Progress reporting',
      'SSO & SCIM',
      'Priority support',
    ],
    featured: false,
  },
];
