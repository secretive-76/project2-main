import { type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { useAuth, roleDashboardPath } from '@/components/providers/auth-provider';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  const { user } = useAuth();
  const dashboardPath = user ? roleDashboardPath[user.role] : '/';

  return (
    <div className="space-y-8 animate-in-slide">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={dashboardPath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={Icon}
        title="Coming soon"
        description="This page is part of the application shell. Full feature pages will be built in the next phase."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to={dashboardPath}>Back to dashboard</Link>
          </Button>
        }
        size="lg"
      />
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Akademia design system · application shell
      </div>
    </div>
  );
}
