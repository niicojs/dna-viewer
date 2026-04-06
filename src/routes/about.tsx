import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

import { AppHeader } from '#/components/app-header';
import { buttonVariants } from '#/components/ui/button';

export const Route = createFileRoute('/about')({ component: About });

function About() {
  return (
    <div className="app-shell">
      <AppHeader
        right_actions={
          <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' gap-1.5 text-xs no-underline'}>
            <ArrowLeft size={13} />
            Back
          </Link>
        }
      />
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
