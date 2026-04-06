import { createFileRoute, Link } from '@tanstack/react-router';
import { Dna, ArrowLeft } from 'lucide-react';
import { buttonVariants } from '#/components/ui/button';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  return (
    <div className="app-shell">
      <header className="app-titlebar">
        <Dna size={16} className="text-primary flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-shrink-0">XDNA Viewer</span>
        <div className="ml-auto">
          <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' gap-1.5 text-xs no-underline'}>
            <ArrowLeft size={13} />
            Back
          </Link>
        </div>
      </header>
      <div className="app-body">
        <main className="app-main">
          <div className="app-panel max-w-lg">
            <h1 className="text-xl font-semibold mb-1">XDNA Viewer</h1>
            <p className="text-sm text-muted-foreground mb-4">
              A local tool for opening, parsing, and inspecting XDNA binary sequence files.
              All processing happens entirely in the browser — no data is uploaded anywhere.
            </p>
            <p className="text-sm text-muted-foreground">
              Supports: sequences, annotations, features, overhangs, and topology metadata.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
