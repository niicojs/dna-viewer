import { Dna, Settings } from 'lucide-react';

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
      <span className="text-foreground shrink-0 text-sm font-semibold">nico's dna viewer</span>

      {file_name && <span className="text-muted-foreground ml-2 max-w-100 truncate text-xs">- {file_name}</span>}

      <div className="ml-auto flex items-center gap-1">
        <a
          href="/settings"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'no-underline')}
          title="Settings"
        >
          <Settings size={14} />
        </a>
        {right_actions}
      </div>
    </header>
  );
}
