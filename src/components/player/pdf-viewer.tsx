import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PdfViewerProps {
  url: string;
  fileName?: string;
  onReachLastPage?: () => void;
}

type PdfSource = string | { url: string; disableRange?: boolean; disableStream?: boolean; disableAutoFetch?: boolean };

type PdfDocument = {
  numPages: number;
  getPage: (page: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  }>;
};

const pdfJsUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const pdfWorkerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function loadPdfJs(): Promise<{ getDocument: (source: PdfSource) => { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } }> {
  const existing = (window as Window & { pdfjsLib?: unknown }).pdfjsLib;
  if (existing) return Promise.resolve(existing as { getDocument: (source: PdfSource) => { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } });

  return new Promise((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>('script[data-akademia-pdfjs]');
    if (script) {
      script.addEventListener('load', () => resolve((window as unknown as { pdfjsLib: { getDocument: (source: PdfSource) => { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } } }).pdfjsLib), { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load PDF reader')), { once: true });
      return;
    }

    const next = document.createElement('script');
    next.src = pdfJsUrl;
    next.async = true;
    next.dataset.akademiaPdfjs = 'true';
    next.onload = () => {
      const library = (window as Window & { pdfjsLib?: { getDocument: (source: PdfSource) => { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } } }).pdfjsLib;
      if (library) resolve(library); else reject(new Error('PDF reader did not load'));
    };
    next.onerror = () => reject(new Error('Could not load PDF reader'));
    document.head.appendChild(next);
  });
}

export function PdfViewer({ url, fileName = 'Document.pdf', onReachLastPage }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const notifiedLastPage = useRef(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    documentRef.current = null;
    notifiedLastPage.current = false;
    setPage(1);
    setTotalPages(0);
    setLoading(true);
    setError('');

    void loadPdfJs()
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        return pdfjs.getDocument({ url, disableRange: true, disableStream: true, disableAutoFetch: true }).promise;
      })
      .then((document) => {
        if (cancelled) return;
        documentRef.current = document;
        setTotalPages(document.numPages);
      })
      .catch(() => {
        if (!cancelled) setError('This PDF could not be displayed. You can download it instead.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || !totalPages) return;

    let cancelled = false;
    void document.getPage(page).then((pdfPage) => {
      if (cancelled || !canvas) return;
      const viewport = pdfPage.getViewport({ scale: (zoom / 100) * 1.35 });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return;
      return pdfPage.render({ canvasContext: context, viewport }).promise;
    }).catch(() => {
      if (!cancelled) setError('This PDF page could not be displayed.');
    });
    return () => { cancelled = true; };
  }, [page, totalPages, zoom]);

  useEffect(() => {
    if (totalPages > 0 && page === totalPages && !notifiedLastPage.current) {
      notifiedLastPage.current = true;
      onReachLastPage?.();
    }
  }, [page, totalPages, onReachLastPage]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{fileName}</span>
        <span className="text-xs text-muted-foreground">{totalPages ? `${page} / ${totalPages}` : 'Loading'}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((value) => Math.max(75, value - 25))} disabled={loading} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((value) => Math.min(175, value + 25))} disabled={loading} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={url} download={fileName} aria-label="Download PDF">
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </header>

      <div className="min-h-[560px] overflow-auto bg-muted/40 p-4">
        {loading ? (
          <div className="grid min-h-[520px] place-items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading document…</div>
        ) : error ? (
          <div className="grid min-h-[520px] place-items-center p-6 text-center text-sm text-muted-foreground">
            <div>
              <p>{error}</p>
              <Button variant="outline" className="mt-3" asChild>
                <a href={url} download={fileName}><Download className="mr-2 h-4 w-4" />Download document</a>
              </Button>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} className="mx-auto max-w-full rounded bg-white shadow-sm" />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border px-3 py-2">
        <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</Button>
        <p className="text-xs text-muted-foreground">{page === totalPages && totalPages > 0 ? 'Final page reached' : 'Read to the final page to complete this lesson.'}</p>
        <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading}>Next page</Button>
      </footer>
    </section>
  );
}
