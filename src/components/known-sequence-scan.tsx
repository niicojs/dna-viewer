import { Check, Eye, Play, Plus, ScanSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '#/components/ui/button';
import type { KnownSequenceCategory, KnownSequenceHit } from '#/lib/known-sequence-scan';
import { getKnownSequenceHits } from '#/lib/known-sequence-scan';
import { cn } from '#/lib/utils';
import type { XdnaFile } from '#/lib/xdna-parser';

type Props = {
  xdna: XdnaFile;
  onPreviewHit: (hit: KnownSequenceHit) => void;
  onAddHit: (hit: KnownSequenceHit) => void;
};

const category_options: { value: KnownSequenceCategory; label: string }[] = [
  { value: 'tag', label: 'Tags' },
  { value: 'promoter', label: 'Promoters' },
  { value: 'terminator', label: 'Terminators' },
  { value: 'restriction_site', label: 'Restriction sites' },
];

function categoryLabel(category: KnownSequenceCategory) {
  if (category === 'promoter') return 'Promoter';
  if (category === 'terminator') return 'Terminator';
  if (category === 'restriction_site') return 'Restriction site';
  return 'Tag';
}

function kindLabel(hit: KnownSequenceHit) {
  return hit.kind === 'dna' ? 'DNA motif' : `Peptide ${hit.frame}`;
}

export function KnownSequenceScan({ xdna, onPreviewHit, onAddHit }: Props) {
  const [enabled_categories, set_enabled_categories] = useState<KnownSequenceCategory[]>(
    category_options.map((option) => option.value),
  );
  const [scanned_hits, set_scanned_hits] = useState<KnownSequenceHit[] | null>(null);

  useEffect(() => {
    set_scanned_hits(null);
  }, [xdna]);

  const hits = scanned_hits ?? [];
  const filtered_hits = useMemo(() => {
    return hits.filter((hit) => enabled_categories.includes(hit.category));
  }, [enabled_categories, hits]);

  function toggleCategory(category: KnownSequenceCategory) {
    set_enabled_categories((current) => {
      if (current.includes(category)) {
        const next_categories = current.filter((value) => value !== category);
        return next_categories.length === 0 ? current : next_categories;
      }

      return [...current, category];
    });
  }

  function runScan() {
    set_scanned_hits(getKnownSequenceHits(xdna));
  }

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)]">
      <section className="space-y-4 overflow-hidden">
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScanSearch size={14} className="text-primary" />
            <h2 className="text-sm font-semibold">Known Sequence Scanner</h2>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Detects built-in known motifs directly in the loaded sequence, including promoters, peptide tags,
            terminators and common restriction sites.
          </p>

          <Button className="mt-4 w-full" onClick={runScan}>
            <Play size={13} />
            Lancer le scan
          </Button>
        </div>

        <div className="border-border bg-card rounded-lg border">
          <div className="border-border border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Filters</h3>
          </div>

          <div className="space-y-2 p-3">
            <StatCard label="Found" value={String(filtered_hits.length)} />
            {category_options.map((option) => {
              const count = hits.filter((hit) => hit.category === option.value).length;
              const is_enabled = enabled_categories.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'border-border flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    is_enabled ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                  )}
                  onClick={() => toggleCategory(option.value)}
                >
                  <span
                    className={cn(
                      'border-border flex size-4 items-center justify-center rounded-sm border',
                      is_enabled && 'bg-primary border-primary text-primary-foreground',
                    )}
                  >
                    {is_enabled && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-border bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Detected sequences</h2>
            <p className="text-muted-foreground mt-1 text-sm">All visible hits are listed here with direct actions.</p>
          </div>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
            {filtered_hits.length} visible
          </span>
        </div>

        {scanned_hits === null ? (
          <div className="flex h-full min-h-80 items-center justify-center">
            <Button size="lg" onClick={runScan}>
              <Play size={14} />
              Lancer le scan
            </Button>
          </div>
        ) : filtered_hits.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filtered_hits.map((hit) => (
              <div key={hit.id} className="border-border bg-muted/20 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{hit.name}</h3>
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {categoryLabel(hit.category)}
                      </span>
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                        {kindLabel(hit)}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-sm leading-relaxed">{hit.description}</p>

                    <div className="grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
                      <InlineDetail label="Coordinates" value={`${hit.start}-${hit.end}`} />
                      <InlineDetail label="Strand" value={hit.strand} />
                      <InlineDetail label="Reference" value={hit.reference_sequence} />
                      <InlineDetail label="Matched DNA" value={hit.matched_sequence} />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onPreviewHit(hit)}>
                      <Eye size={13} />
                      Preview
                    </Button>
                    <Button size="sm" onClick={() => onAddHit(hit)}>
                      <Plus size={13} />
                      Add feature
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex h-full min-h-80 items-center justify-center text-sm">
            No known sequences match the active filters.
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-3">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function InlineDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-sm font-semibold break-all">{value}</div>
    </div>
  );
}
