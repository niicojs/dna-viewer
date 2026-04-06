import { createFileRoute } from '@tanstack/react-router';
import { FolderOpen, Dna, List, AlignLeft, Info, Sun, Moon, Monitor, Circle, Minus, AlertCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { PlasmidMap, LinearMap } from '#/components/dna-map';
import { FeatureList } from '#/components/feature-list';
import { SequenceViewer } from '#/components/sequence-viewer';
import { Button } from '#/components/ui/button';
import { cn } from '#/lib/utils';
import { readXdnaFile } from '#/lib/xdna-parser';
import type { XdnaFile } from '#/lib/xdna-parser';

export const Route = createFileRoute('/')({ component: App });

type Tab = 'map' | 'sequence' | 'info';
type MapMode = 'circular' | 'linear';
type Theme = 'light' | 'dark' | 'auto';

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem('theme') as Theme) ?? 'auto';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (t === 'auto') {
      root.removeAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(t);
      root.setAttribute('data-theme', t);
    }
  };

  return { theme, setTheme };
}

function App() {
  const [xdna, setXdna] = useState<XdnaFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [mapMode, setMapMode] = useState<MapMode>('circular');
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xdna')) {
      setError(`Not an XDNA file: "${file.name}"`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsed = await readXdnaFile(file);
      setXdna(parsed);
      setSelectedFeature(null);
      setActiveTab('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const nextTheme: Theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  const features = xdna?.annotations?.features ?? [];

  return (
    <div className="app-shell">
      {/* ── Title bar ──────────────────────────────────────────── */}
      <header className="app-titlebar">
        <Dna size={16} className="text-primary flex-shrink-0" />
        <span className="text-foreground flex-shrink-0 text-sm font-semibold">XDNA Viewer</span>

        {xdna && <span className="text-muted-foreground ml-2 max-w-[200px] truncate text-xs">— {xdna.file.name}</span>}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setTheme(nextTheme)} title={`Theme: ${theme}`}>
            <ThemeIcon size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-xs">
            <FolderOpen size={13} />
            Open file
          </Button>
          <input ref={fileInputRef} type="file" accept=".xdna" className="hidden" onChange={onFileInput} />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="app-body">
        {/* ── Sidebar ── */}
        {xdna && (
          <aside className="app-sidebar">
            <div className="border-border flex flex-shrink-0 items-center gap-2 border-b px-3 py-2">
              <List size={13} className="text-muted-foreground" />
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Features</span>
              <span className="text-muted-foreground bg-muted ml-auto rounded-full px-1.5 py-0.5 text-xs font-medium">
                {features.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <FeatureList features={features} selectedFeature={selectedFeature} onSelectFeature={setSelectedFeature} />
            </div>

            <div className="border-border text-muted-foreground flex-shrink-0 space-y-0.5 border-t px-3 py-2.5 text-xs">
              <div className="flex justify-between">
                <span>Type</span>
                <span className="text-foreground font-medium">{xdna.header.sequenceType}</span>
              </div>
              <div className="flex justify-between">
                <span>Length</span>
                <span className="text-foreground font-medium">{xdna.header.sequenceLength.toLocaleString()} bp</span>
              </div>
              <div className="flex justify-between">
                <span>Topology</span>
                <span className="text-foreground font-medium capitalize">{xdna.header.topology}</span>
              </div>
              {xdna.annotations?.rightOverhang.type !== 'none' && (
                <div className="flex justify-between">
                  <span>3′ overhang</span>
                  <span className="text-foreground font-mono font-medium">
                    {xdna.annotations?.rightOverhang.sequence}
                  </span>
                </div>
              )}
              {xdna.annotations?.leftOverhang.type !== 'none' && (
                <div className="flex justify-between">
                  <span>5′ overhang</span>
                  <span className="text-foreground font-mono font-medium">
                    {xdna.annotations?.leftOverhang.sequence}
                  </span>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Main panel ── */}
        <main className="app-main">
          {/* Tab bar */}
          {xdna && (
            <div className="app-tabs-bar">
              <button className={cn('app-tab', activeTab === 'map' && 'active')} onClick={() => setActiveTab('map')}>
                <Dna size={12} />
                Map
              </button>
              <button
                className={cn('app-tab', activeTab === 'sequence' && 'active')}
                onClick={() => setActiveTab('sequence')}
              >
                <AlignLeft size={12} />
                Sequence
              </button>
              <button className={cn('app-tab', activeTab === 'info' && 'active')} onClick={() => setActiveTab('info')}>
                <Info size={12} />
                Info
              </button>

              {activeTab === 'map' && (
                <div className="ml-auto flex items-center gap-0.5 px-2">
                  <button
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                      mapMode === 'circular'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setMapMode('circular')}
                  >
                    <Circle size={10} />
                    Circular
                  </button>
                  <button
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                      mapMode === 'linear'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setMapMode('linear')}
                  >
                    <Minus size={10} />
                    Linear
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="app-panel">
            {/* Welcome / drop-zone */}
            {!xdna && !loading && !error && (
              <div
                className={cn(
                  'drop-zone flex flex-col items-center justify-center gap-4 h-full min-h-[400px]',
                  dragOver && 'drag-over',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <div className="bg-accent rounded-full p-5">
                  <Dna size={36} className="text-primary" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-foreground font-semibold">Open an XDNA file</p>
                  <p className="text-muted-foreground text-sm">
                    Drag & drop a <code className="text-xs">.xdna</code> file here, or use the button above
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <FolderOpen size={14} />
                  Browse files
                </Button>
              </div>
            )}

            {/* Loading spinner */}
            {loading && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                <p className="text-muted-foreground text-sm">Parsing file…</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4">
                <div className="bg-destructive/10 rounded-full p-4">
                  <AlertCircle size={28} className="text-destructive" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-foreground font-semibold">Parse error</p>
                  <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    fileInputRef.current?.click();
                  }}
                >
                  Try another file
                </Button>
              </div>
            )}

            {/* Map tab */}
            {xdna && activeTab === 'map' && (
              <div
                className="flex h-full items-start justify-center"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {mapMode === 'circular' ? (
                  <div className="aspect-square w-full max-w-[440px] p-2">
                    <PlasmidMap xdna={xdna} selectedFeature={selectedFeature} onSelectFeature={setSelectedFeature} />
                  </div>
                ) : (
                  <div className="w-full max-w-3xl pt-2">
                    <LinearMap xdna={xdna} selectedFeature={selectedFeature} onSelectFeature={setSelectedFeature} />
                  </div>
                )}
              </div>
            )}

            {/* Sequence tab */}
            {xdna && activeTab === 'sequence' && (
              <SequenceViewer sequence={xdna.sequence} features={features} selectedFeature={selectedFeature} />
            )}

            {/* Info tab */}
            {xdna && activeTab === 'info' && (
              <div className="max-w-lg space-y-4">
                <section>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">File</h3>
                  <InfoGrid
                    rows={[
                      ['Name', xdna.file.name],
                      ['Format', xdna.file.format],
                      ['Size', `${xdna.file.size.toLocaleString()} bytes`],
                    ]}
                  />
                </section>

                <section>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Header</h3>
                  <InfoGrid
                    rows={[
                      ['Version', String(xdna.header.version)],
                      ['Sequence type', xdna.header.sequenceType],
                      ['Topology', xdna.header.topology],
                      ['Sequence length', `${xdna.header.sequenceLength.toLocaleString()} bp`],
                      ['Comment length', `${xdna.header.commentLength} bytes`],
                    ]}
                  />
                </section>

                {xdna.comment && (
                  <section>
                    <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                      Comment
                    </h3>
                    <p className="text-foreground bg-muted/40 rounded-md p-3 text-sm leading-relaxed">{xdna.comment}</p>
                  </section>
                )}

                <section>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                    Byte offsets
                  </h3>
                  <InfoGrid
                    rows={[
                      ['Header', `0 – ${xdna.offsets.header.end}`],
                      ['Sequence', `${xdna.offsets.sequence.start} – ${xdna.offsets.sequence.end}`],
                      ['Comment', `${xdna.offsets.comment.start} – ${xdna.offsets.comment.end}`],
                      xdna.offsets.annotations
                        ? ['Annotations', `${xdna.offsets.annotations.start} – ${xdna.offsets.annotations.end}`]
                        : ['Annotations', 'none'],
                    ]}
                  />
                </section>

                {xdna.annotations && (
                  <section>
                    <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                      Annotations
                    </h3>
                    <InfoGrid
                      rows={[
                        ['Feature count', String(xdna.annotations.featureCount)],
                        [
                          'Right overhang',
                          xdna.annotations.rightOverhang.type === 'none'
                            ? 'none'
                            : `${xdna.annotations.rightOverhang.type} — ${xdna.annotations.rightOverhang.sequence}`,
                        ],
                        [
                          'Left overhang',
                          xdna.annotations.leftOverhang.type === 'none'
                            ? 'none'
                            : `${xdna.annotations.leftOverhang.type} — ${xdna.annotations.leftOverhang.sequence}`,
                        ],
                      ]}
                    />
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="border-border divide-border divide-y overflow-hidden rounded-md border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex">
          <span className="bg-muted/40 text-muted-foreground w-36 flex-shrink-0 px-3 py-2 text-xs font-medium">
            {label}
          </span>
          <span className="text-foreground flex-1 px-3 py-2 font-mono text-xs break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
