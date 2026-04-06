import { TanStackDevtools } from '@tanstack/react-devtools';
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { ArrowLeft, Compass, Dna } from 'lucide-react';

import { AppHeader } from '#/components/app-header';
import { buttonVariants } from '#/components/ui/button';

import appCss from '../styles.css?url';

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'XDNA Viewer' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/icon-192.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundPage() {
  return (
    <div className="app-shell">
      <AppHeader
        right_actions={
          <Link to="/" className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' gap-1.5 text-xs no-underline'}>
            <ArrowLeft size={13} />
            Back home
          </Link>
        }
      />
      <div className="app-body">
        <main className="app-main">
          <div className="app-panel flex min-h-96 items-center justify-center">
            <div className="max-w-md text-center">
              <div className="bg-accent mx-auto mb-5 flex size-16 items-center justify-center rounded-full">
                <Compass size={28} className="text-primary" />
              </div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.24em] uppercase">Error 404</p>
              <h1 className="text-foreground mb-3 text-2xl font-semibold">This DNA trail ends here</h1>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                The page you requested does not exist or has moved. Use the link below to return to the main viewer.
              </p>
              <div className="flex justify-center">
                <Link to="/" className={buttonVariants({ size: 'sm' }) + ' gap-1.5 text-xs no-underline'}>
                  <Dna size={13} />
                  Open viewer
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
