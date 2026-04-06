import { createFileRoute, Link } from '@tanstack/react-router';
import { Dna, ArrowLeft } from 'lucide-react';

import { buttonVariants } from '#/components/ui/button';

export const Route = createFileRoute('/about')({ component: About });

function About() {
  return (
    <div className="app-shell">
      <header className="app-titlebar">
        <Dna size={16} className="text-primary shrink-0" />
        <span className="text-foreground shrink-0 text-sm font-semibold">nico's dna viewer</span>
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
            <h1 className="mb-1 text-xl font-semibold">XDNA Viewer</h1>
            <p className="text-muted-foreground mb-4 text-sm">
              A local tool for opening, parsing, and inspecting XDNA binary sequence files. All processing happens
              entirely in the browser — no data is uploaded anywhere.
            </p>
            <p className="text-muted-foreground text-sm">
              Supports: sequences, annotations, features, overhangs, and topology metadata.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
