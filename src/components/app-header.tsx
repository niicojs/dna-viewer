import { Link } from '@tanstack/react-router';
import { Dna, GitCompareArrows, Settings } from 'lucide-react';

import { buttonVariants } from '#/components/ui/button';
import { cn } from '#/lib/utils';

type Props = {
  file_name?: string | null;
  right_actions?: React.ReactNode;
};

export function AppHeader({ file_name, right_actions }: Props) {
  return (
    <header className="app-titlebar">
      <Dna size={16} className="text-primary shrink-0" />
      <span className="text-foreground shrink-0 text-sm font-semibold">
        <Link to={'/'}>nico's dna viewer</Link>
      </span>

      {file_name && <span className="text-muted-foreground ml-2 max-w-100 truncate text-xs">- {file_name}</span>}

      <div className="ml-auto flex items-center gap-1">
        <Link
          to={'/align'}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'no-underline')}
          title="Align"
        >
          <GitCompareArrows size={14} />
        </Link>
        <Link
          to={'/settings'}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'no-underline')}
          title="Settings"
        >
          <Settings size={14} />
        </Link>
        {right_actions}
      </div>
    </header>
  );
}
