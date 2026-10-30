import { useState, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CodeBlock({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const [copied, setCopied] = useState(false);
  const isInline = !className;

  if (isInline) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  }

  const lang = className?.replace('language-', '') ?? '';
  const codeText = String(children).replace(/\n$/, '');

  const copy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-foreground">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5">
        <span className="text-xs font-medium text-background/60">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-background/60 transition-colors hover:text-background"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code className="font-mono text-background/90" {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground',
        'prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2',
        'prose-h4:text-sm prose-h4:mt-3 prose-h4:mb-1.5',
        'prose-p:text-muted-foreground prose-p:leading-relaxed',
        'prose-strong:text-foreground',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-muted-foreground',
        'prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-0.5 prose-blockquote:pl-3 prose-blockquote:not-italic prose-blockquote:text-muted-foreground prose-blockquote:rounded-r',
        'prose-table:my-3 prose-table:text-sm',
        'prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-th:text-foreground',
        'prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-td:text-muted-foreground',
        'prose-hr:border-border',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock as never,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
