import { Link } from 'react-router-dom';
import { Twitter, Github, Linkedin, Youtube } from 'lucide-react';
import { Logo } from '@/components/common/logo';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Courses', href: '#courses' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'AI Coach', href: '/student/ai-coach' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Resources: [
    { label: 'Help Center', href: '#' },
    { label: 'Community', href: '#' },
    { label: 'Tutorials', href: '#' },
    { label: 'API Docs', href: '#' },
  ],
  Legal: [
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Security', href: '#' },
    { label: 'Cookies', href: '#' },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="space-y-4">
            <Logo size="md" />
            <p className="max-w-xs text-sm text-muted-foreground">
              AI-powered learning that adapts to how you think. Master new skills faster with a
              personal coach that never sleeps.
            </p>
            <div className="flex items-center gap-2">
              {[Twitter, Github, Linkedin, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                  aria-label="Social link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Akademia. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Crafted for learners, by learners.
          </p>
        </div>
      </div>
    </footer>
  );
}
