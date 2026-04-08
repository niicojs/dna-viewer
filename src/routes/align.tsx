import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Check, Copy, Dna, FolderOpen, LoaderCircle, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { AppHeader } from '#/components/app-header';
import { Button, buttonVariants } from '#/components/ui/button';
import { FILE_ACCEPT } from '#/lib/const';
import {
  alignDnaSequences,
  readAlignmentSequenceFile,
  type AlignmentResult,
  type LoadedSequenceFile,
} from '#/lib/dna-alignment';
import { cn } from '#/lib/utils';

export const Route = createFileRoute('/align')({ component: AlignPage });

function AlignPage() {
  const [query_file, set_query_file] = useState<LoadedSequenceFile | null>(null);
  const [reference_file, set_reference_file] = useState<LoadedSequenceFile | null>(null);
  const [alignment, set_alignment] = useState<AlignmentResult | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [loading_side, set_loading_side] = useState<'query' | 'reference' | null>(null);
  const [aligning, set_aligning] = useState(false);
  const [copied_cigar, set_copied_cigar] = useState(false);
  const query_input_ref = useRef<HTMLInputElement>(null);
  const reference_input_ref = useRef<HTMLInputElement>(null);

  async function loadFile(side: 'query' | 'reference', file: File) {
    set_loading_side(side);
    set_error(null);

    try {
      const parsed = await readAlignmentSequenceFile(file);

      if (side === 'query') {
        set_query_file(parsed);
      } else {
        set_reference_file(parsed);
      }

      set_alignment(null);
      set_copied_cigar(false);
    } catch (err) {
      set_error(err instanceof Error ? err.message : String(err));
    } finally {
      set_loading_side((current) => (current === side ? null : current));
    }
  }

  async function runAlignment() {
    if (!query_file || !reference_file) {
      return;
    }

    set_aligning(true);
    set_error(null);

    try {
      const next_alignment = alignDnaSequences(query_file.sequence, reference_file.sequence);
      set_alignment(next_alignment);
      set_copied_cigar(false);
    } catch (err) {
      set_error(err instanceof Error ? err.message : String(err));
      set_alignment(null);
    } finally {
      set_aligning(false);
    }
  }

  function clearFile(side: 'query' | 'reference') {
    if (side === 'query') {
      set_query_file(null);
    } else {
      set_reference_file(null);
    }

    set_alignment(null);
    set_copied_cigar(false);
    set_error(null);
  }

  async function copyCigarValue() {
    if (!alignment?.cigar_text) {
      return;
    }

    await navigator.clipboard.writeText(alignment.cigar_text);
    set_copied_cigar(true);
    window.setTimeout(() => set_copied_cigar(false), 1500);
  }

  return (
    <div className="app-shell">
      <AppHeader
        right_actions={
          <Link to="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-xs no-underline')}>
            <ArrowLeft size={13} />
            Back to viewer
          </Link>
        }
      />

      <div className="app-body">
        <main className="app-main">
          <div className="app-panel space-y-6">
            <section className="max-w-3xl space-y-2">
              <h1 className="text-xl font-semibold">DNA alignment</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Load a query sequence and a reference sequence, then run a local Smith-Waterman alignment.
              </p>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <SequenceCard
                title="Query"
                subtitle="Sequence being aligned"
                file={query_file}
                loading={loading_side === 'query'}
                onBrowse={() => query_input_ref.current?.click()}
                onClear={() => clearFile('query')}
              />

              <SequenceCard
                title="Reference"
                subtitle="Sequence to align against"
                file={reference_file}
                loading={loading_side === 'reference'}
                onBrowse={() => reference_input_ref.current?.click()}
                onClear={() => clearFile('reference')}
              />

              <input
                ref={query_input_ref}
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void loadFile('query', file);
                  }
                  event.target.value = '';
                }}
              />
              <input
                ref={reference_input_ref}
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void loadFile('reference', file);
                  }
                  event.target.value = '';
                }}
              />
            </section>

            <section className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void runAlignment()} disabled={!query_file || !reference_file || aligning}>
                {aligning ? <LoaderCircle size={14} className="animate-spin" /> : <Dna size={14} />}
                Align sequences
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  set_alignment(null);
                  set_error(null);
                }}
                disabled={!alignment && !error}
              >
                <RefreshCcw size={14} />
                Reset result
              </Button>
              <span className="text-muted-foreground text-xs">
                Accepted formats: .xdna, .txt, .fa, .fas, .fasta, .fna, .gb, .gbk, .genbank, .ape, .dna, .seq, .xml, .rdf, .jbei
              </span>
            </section>

            {error && (
              <section className="border-destructive/30 bg-destructive/8 rounded-lg border p-4">
                <p className="text-destructive text-sm font-medium">Alignment failed</p>
                <p className="text-muted-foreground mt-1 text-sm">{error}</p>
              </section>
            )}

            {alignment && query_file && reference_file && (
              <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Score" value={alignment.score.toString()} />
                  <MetricCard label="Identity" value={formatPercent(alignment.identity)} />
                  <MetricCard label="MAPQ" value={alignment.mapping_quality.toString()} />
                  <ActionCard
                    label="CIGAR"
                    helper={copied_cigar ? 'Copied' : 'Copy to clipboard'}
                    button_label={copied_cigar ? 'Copied' : 'Copy CIGAR'}
                    icon={copied_cigar ? <Check size={14} /> : <Copy size={14} />}
                    onClick={() => void copyCigarValue()}
                  />
                </section>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <InfoPanel
                      title="Reference mapping"
                      rows={[
                        ['Reference start', String(alignment.reference_start + 1)],
                        ['Reference end', String(alignment.reference_end)],
                        ['Query start', String(alignment.query_start + 1)],
                        ['Query end', String(alignment.query_end)],
                      ]}
                    />

                    <InfoPanel
                      title="Alignment stats"
                      rows={[
                        ['Matches', String(alignment.matches)],
                        ['Mismatches', String(alignment.mismatches)],
                        ['Insertions', String(alignment.insertions)],
                        ['Deletions', String(alignment.deletions)],
                        ['Aligned length', String(alignment.aligned_length)],
                      ]}
                    />

                    <InfoPanel
                      title="Files"
                      rows={[
                        ['Query', `${query_file.name} (${query_file.sequence.length.toLocaleString()} bp)`],
                        ['Reference', `${reference_file.name} (${reference_file.sequence.length.toLocaleString()} bp)`],
                      ]}
                    />
                  </div>

                  <section className="border-border bg-card overflow-hidden rounded-xl border">
                    <div className="border-border bg-muted/30 flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold">Alignment view</h2>
                        <p className="text-muted-foreground text-xs">
                          <code>|</code> exact match, <code>.</code> mismatch, blank space gap
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 overflow-auto p-4">
                      {alignment.blocks.map((block, index) => (
                        <div
                          key={`${block.query_start}-${block.reference_start}-${index}`}
                          className="rounded-lg bg-black/3 p-3 dark:bg-white/3"
                        >
                          <div className="font-mono text-xs leading-6">
                            <AlignmentLine label={`Q ${block.query_start + 1}`} sequence={block.query_aligned} />
                            <AlignmentLine label=" " sequence={block.marker_line} subtle />
                            <AlignmentLine
                              label={`R ${block.reference_start + 1}`}
                              sequence={block.reference_aligned}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SequenceCard({
  title,
  subtitle,
  file,
  loading,
  onBrowse,
  onClear,
}: {
  title: string;
  subtitle: string;
  file: LoadedSequenceFile | null;
  loading: boolean;
  onBrowse: () => void;
  onClear: () => void;
}) {
  return (
    <section className="border-border bg-card rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBrowse} disabled={loading}>
            {loading ? <LoaderCircle size={13} className="animate-spin" /> : <FolderOpen size={13} />}
            {file ? 'Replace' : 'Load file'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={!file || loading}>
            <Trash2 size={13} />
            Clear
          </Button>
        </div>
      </div>

      {!file && !loading && (
        <div className="border-border bg-muted/20 mt-4 flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center">
          <Upload size={20} className="text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No file loaded</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
            Load XDNA or a sequence file such as FASTA, GenBank, SnapGene, SBOL, or JBEI to use as the {title.toLowerCase()} sequence.
          </p>
        </div>
      )}

      {file && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <InlineStat label="Format" value={file.format} />
            <InlineStat label="Length" value={`${file.sequence.length.toLocaleString()} bp`} />
            <InlineStat label="Size" value={`${file.size.toLocaleString()} B`} />
          </div>

          <div className="rounded-lg bg-black/3 p-3 dark:bg-white/3">
            <p className="truncate text-sm font-medium">{file.name}</p>
            {file.comment && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{file.comment}</p>}
            <p className="text-muted-foreground mt-2 font-mono text-xs break-all">{previewSequence(file.sequence)}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
      <p className={cn('mt-2 text-lg font-semibold', mono && 'font-mono text-sm break-all')}>{value}</p>
    </div>
  );
}

function ActionCard({
  label,
  helper,
  button_label,
  icon,
  onClick,
}: {
  label: string;
  helper: string;
  button_label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
      <p className="text-muted-foreground mt-2 text-sm">{helper}</p>
      <Button variant="outline" size="sm" onClick={onClick} className="mt-3 w-full justify-center">
        {icon}
        {button_label}
      </Button>
    </div>
  );
}

function InfoPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/30 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-border divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 px-4 py-3 text-sm">
            <span className="text-muted-foreground w-28 shrink-0">{label}</span>
            <span className="text-foreground min-w-0 flex-1 font-mono text-xs break-all">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/3 px-3 py-2 dark:bg-white/3">
      <p className="text-muted-foreground text-[11px] uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function AlignmentLine({ label, sequence, subtle = false }: { label: string; sequence: string; subtle?: boolean }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
      <span className="text-muted-foreground text-right">{label}</span>
      <span className={cn('overflow-x-auto whitespace-pre break-all', subtle && 'text-muted-foreground')}>
        {sequence}
      </span>
    </div>
  );
}

function previewSequence(sequence: string) {
  if (sequence.length <= 120) {
    return sequence;
  }

  return `${sequence.slice(0, 60)}...${sequence.slice(-60)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}
