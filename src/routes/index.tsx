import { createFileRoute } from '@tanstack/react-router';
import {
  FolderOpen,
  Dna,
  List,
  Info,
  Sun,
  Moon,
  Monitor,
  Circle,
  Minus,
  LayoutTemplate,
  AlertCircle,
  Search,
  X,
  Plus,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ExternalSelection, Selection } from 'seqviz/dist/selectionContext';

import { FeatureList } from '#/components/feature-list';
import { SeqVizViewer } from '#/components/seqviz-viewer';
import { Button } from '#/components/ui/button';
import { useTheme, type Theme } from '#/lib/use-theme';
import { cn } from '#/lib/utils';
import type { Feature } from '#/lib/xdna-parser';
import { readXdnaFile } from '#/lib/xdna-parser';
import type { XdnaFile } from '#/lib/xdna-parser';

export const Route = createFileRoute('/')({ component: App });

type ViewerMode = 'circular' | 'linear' | 'both';
type Tab = 'viewer' | 'info';

function update_features(xdna: XdnaFile, updater: (features: Feature[]) => Feature[]): XdnaFile {
  const current_annotations = xdna.annotations ?? {
    marker: 0,
    rightOverhang: { side: 'right' as const, type: 'none' as const, declaredLength: 0, sequence: '' },
    leftOverhang: { side: 'left' as const, type: 'none' as const, declaredLength: 0, sequence: '' },
    featureCount: 0,
    features: [],
    trailingBytes: 0,
  };

  const features = updater(current_annotations.features);

  return {
    ...xdna,
    annotations: {
      ...current_annotations,
      featureCount: features.length,
      features,
    },
  };
}

function create_feature(sequence_length: number, index: number, selection?: Selection): Feature {
  const max_position = Math.max(sequence_length, 1);
  const start = selection?.start ? Math.max(1, selection.start) : 1;
  const end = selection?.end ? Math.max(1, selection.end) : max_position;

  return {
    index,
    name: `Feature ${index}`,
    description: '',
    descriptionLines: [],
    type: 'misc_feature',
    start,
    end,
    flags: {
      strand: selection?.clockwise === false ? 'reverse' : 'forward',
      rawStrand: selection?.clockwise === false ? 0 : 1,
      visible: true,
      rawVisible: 1,
      unknown: 0,
      arrow: true,
      rawArrow: 1,
    },
    color: '150,150,150,',
  };
}

function App() {
  const [xdna, setXdna] = useState<XdnaFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('viewer');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('circular');
  const [selectedFeature, setSelectedFeature] = useState<Selection | undefined>(undefined);
  const [featureToEdit, setFeatureToEdit] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
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
      setSelectedFeature(undefined);
      setFeatureToEdit(null);
      setSearch('');
      setActiveTab('viewer');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const features = xdna?.annotations?.features ?? [];

  // Find selected feature index by name for the sidebar
  // const selectedFeatureIndex = selectedFeature
  //   ? (features.find((f) => f.name === selectedFeature.name && f.start === selectedFeature.start)?.index ?? null)
  //   : null;

  let selectedFeatureIndex: number | null = null;
  if (selectedFeature) {
    selectedFeatureIndex =
      features.find((f) => f.name === selectedFeature.name && f.start === selectedFeature.start)?.index ?? null;
  }

  // Sidebar click → highlight by name
  const handleSidebarSelect = useCallback(
    (index: number | null) => {
      const f = features.find((feat) => feat.index === index);
      if (!f) setSelectedFeature(undefined);
      else {
        setSelectedFeature({
          start: f.start,
          end: f.end,
          name: f.name,
          type: f.type as any,
          clockwise: f.flags.strand !== 'reverse',
        });
      }
    },
    [features],
  );

  const handleFeatureUpdate = useCallback(
    (index: number, next_feature: Feature) => {
      setXdna((current) =>
        current
          ? update_features(current, (current_features) =>
              current_features.map((feature) => (feature.index === index ? next_feature : feature)),
            )
          : current,
      );

      setSelectedFeature((current_selection) => {
        if (!current_selection || selectedFeatureIndex !== index) {
          return current_selection;
        }

        return {
          start: next_feature.start,
          end: next_feature.end,
          name: next_feature.name,
          type: next_feature.type as any,
          clockwise: next_feature.flags.strand !== 'reverse',
        };
      });
    },
    [selectedFeatureIndex],
  );

  const handleFeatureAdd = useCallback(() => {
    const next_index = features.reduce((max, feature) => Math.max(max, feature.index), 0) + 1;
    const next_feature = xdna ? create_feature(xdna.header.sequenceLength, next_index, selectedFeature) : null;

    if (!next_feature) {
      return;
    }

    setXdna((current) => {
      if (!current) {
        return current;
      }

      return update_features(current, (current_features) => [...current_features, next_feature]);
    });
    setFeatureToEdit(next_index);

    setSelectedFeature({
      start: next_feature.start,
      end: next_feature.end,
      name: next_feature.name,
      type: next_feature.type as any,
      clockwise: next_feature.flags.strand !== 'reverse',
    });
  }, [features, selectedFeature, xdna]);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const nextTheme: Theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';

  return (
    <div className="app-shell">
      {/* ── Title bar ── */}
      <header className="app-titlebar">
        <Dna size={16} className="text-primary shrink-0" />
        <span className="text-foreground shrink-0 text-sm font-semibold">nico's dna viewer</span>

        {xdna && <span className="text-muted-foreground ml-2 max-w-100 truncate text-xs">— {xdna.file.name}</span>}

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

      {/* ── Body ── */}
      <div className="app-body">
        {/* ── Sidebar ── */}
        {xdna && (
          <aside className="app-sidebar">
            <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <List size={13} className="text-muted-foreground" />
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Features</span>
              <span className="text-muted-foreground bg-muted ml-auto rounded-full px-1.5 py-0.5 text-xs font-medium">
                {features.length}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={handleFeatureAdd} title="Add feature">
                <Plus size={13} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <FeatureList
                features={features}
                selectedFeature={selectedFeatureIndex}
                onSelectFeature={handleSidebarSelect}
                onUpdateFeature={handleFeatureUpdate}
                autoEditFeature={featureToEdit}
                onAutoEditHandled={() => setFeatureToEdit(null)}
              />
            </div>

            <div className="border-border text-muted-foreground shrink-0 space-y-0.5 border-t px-3 py-2.5 text-xs">
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
          {xdna && (
            <div className="app-tabs-bar">
              <button
                className={cn('app-tab', activeTab === 'viewer' && 'active')}
                onClick={() => setActiveTab('viewer')}
              >
                <Dna size={12} />
                Viewer
              </button>
              <button className={cn('app-tab', activeTab === 'info' && 'active')} onClick={() => setActiveTab('info')}>
                <Info size={12} />
                Info
              </button>

              {activeTab === 'viewer' && (
                <>
                  <div className="ml-auto flex items-center gap-0.5 px-2">
                    {(
                      [
                        { mode: 'circular', icon: <Circle size={10} />, label: 'Circular' },
                        { mode: 'linear', icon: <Minus size={10} />, label: 'Linear' },
                        { mode: 'both', icon: <LayoutTemplate size={10} />, label: 'Both' },
                      ] as const
                    ).map(({ mode, icon, label }) => (
                      <button
                        key={mode}
                        className={cn(
                          'flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
                          viewerMode === mode
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => setViewerMode(mode)}
                      >
                        {icon}
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="border-border flex items-center gap-1 border-l px-2">
                    <Search size={11} className="text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search sequence…"
                      className="placeholder:text-muted-foreground h-full w-28 bg-transparent text-xs outline-none"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Panel content */}
          <div className="app-panel" style={{ padding: activeTab === 'viewer' && xdna ? 0 : undefined }}>
            {/* Welcome / drop-zone */}
            {!xdna && !loading && !error && (
              <div
                className={cn(
                  'drop-zone flex flex-col items-center justify-center gap-4 h-full min-h-100',
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

            {/* Loading */}
            {loading && (
              <div className="flex h-full min-h-100 flex-col items-center justify-center gap-3">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                <p className="text-muted-foreground text-sm">Parsing file…</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex h-full min-h-75 flex-col items-center justify-center gap-4">
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

            {/* SeqViz viewer */}
            {xdna && activeTab === 'viewer' && (
              <div
                className="h-full w-full"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <SeqVizViewer
                  xdna={xdna}
                  viewer={viewerMode}
                  selection={selectedFeature as ExternalSelection}
                  onSelection={(selection) => setSelectedFeature(selection)}
                  search={search}
                />
              </div>
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
          <span className="bg-muted/40 text-muted-foreground w-36 shrink-0 px-3 py-2 text-xs font-medium">{label}</span>
          <span className="text-foreground flex-1 px-3 py-2 font-mono text-xs break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}
