import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { AppHeader } from '#/components/app-header';
import { Button, buttonVariants } from '#/components/ui/button';
import type { KnownSequenceCategory, KnownSequenceTarget } from '#/lib/known-sequence-scan';
import {
  SCAN_SETTINGS_FILE_NAME,
  colorToHex,
  createSequenceFromDraft,
  getDefaultScanSettings,
  hexToColor,
  loadScanSettings,
  sanitizeScanSettings,
  saveScanSettings,
  type ScanSettings,
  type ScanSettingsSequenceDraft,
} from '#/lib/scan-settings';
import { cn } from '#/lib/utils';

export const Route = createFileRoute('/settings')({ component: SettingsPage });

const category_options: { value: KnownSequenceCategory; label: string }[] = [
  { value: 'tag', label: 'Tag' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'terminator', label: 'Terminator' },
  { value: 'restriction_site', label: 'Restriction site' },
];

const default_draft: ScanSettingsSequenceDraft = {
  name: '',
  category: 'tag',
  kind: 'dna',
  description: '',
  sequence: '',
  feature_type: 'misc_feature',
  color: '87,124,255,',
};

function SettingsPage() {
  const [settings, set_settings] = useState<ScanSettings>(() => loadScanSettings());
  const [draft, set_draft] = useState<ScanSettingsSequenceDraft>(default_draft);
  const [editing_index, set_editing_index] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const file_input_ref = useRef<HTMLInputElement>(null);

  function persist(next_settings: ScanSettings) {
    const sanitized = sanitizeScanSettings(next_settings);
    set_settings(sanitized);
    saveScanSettings(sanitized);
  }

  function saveSequence() {
    if (!draft.name.trim() || !draft.description.trim() || !draft.sequence.trim()) {
      set_error('Name, description and sequence are required.');
      return;
    }

    const next_entry = createSequenceFromDraft(draft);

    if (editing_index !== null) {
      persist({
        version: 1,
        known_sequences: settings.known_sequences.map((entry, index) => (index === editing_index ? next_entry : entry)),
      });
    } else {
      persist({
        version: 1,
        known_sequences: [...settings.known_sequences, next_entry],
      });
    }

    set_draft(default_draft);
    set_editing_index(null);
    set_error(null);
  }

  function startEditing(index: number) {
    const entry = settings.known_sequences[index];

    if (!entry) {
      return;
    }

    set_draft({
      name: entry.name,
      category: entry.category,
      kind: entry.kind,
      description: entry.description,
      sequence: entry.sequence,
      feature_type: entry.feature_type,
      color: entry.color,
    });
    set_editing_index(index);
    set_error(null);
  }

  function cancelEditing() {
    set_draft(default_draft);
    set_editing_index(null);
    set_error(null);
  }

  function removeSequence(index: number) {
    persist({
      version: 1,
      known_sequences: settings.known_sequences.filter((_, current_index) => current_index !== index),
    });

    if (editing_index === index) {
      cancelEditing();
    } else if (editing_index !== null && index < editing_index) {
      set_editing_index(editing_index - 1);
    }
  }

  function resetSettings() {
    persist(getDefaultScanSettings());
    cancelEditing();
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = SCAN_SETTINGS_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importSettings(file: File) {
    try {
      const raw = await file.text();
      persist(sanitizeScanSettings(JSON.parse(raw)));
      set_error(null);
    } catch {
      set_error(`Unable to load ${SCAN_SETTINGS_FILE_NAME}.`);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader
        right_actions={
          <>
            <Button variant="ghost" size="sm" onClick={exportSettings}>
              <Download size={13} />
              Save settings
            </Button>
            <Button variant="ghost" size="sm" onClick={() => file_input_ref.current?.click()}>
              <Upload size={13} />
              Load settings
            </Button>
            <Link
              to="/"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-xs no-underline')}
            >
              <ArrowLeft size={13} />
              Back
            </Link>
            <input
              ref={file_input_ref}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importSettings(file);
                }
                event.target.value = '';
              }}
            />
          </>
        }
      />

      <div className="app-body">
        <main className="app-main">
          <div className="app-panel space-y-6">
            <section className="max-w-4xl space-y-2">
              <h1 className="text-xl font-semibold">Sequence scan settings</h1>
              <p className="text-muted-foreground text-sm">
                Define the full known DNA and peptide reference list used by the Sequence Scan tab. Settings are stored
                locally and can also be exported/imported.
              </p>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
              <div className="border-border bg-card space-y-4 rounded-lg border p-4">
                <div>
                  <h2 className="text-sm font-semibold">{editing_index !== null ? 'Edit sequence' : 'Add sequence'}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    DNA entries scan raw nucleotides. Peptide entries scan translated reading frames.
                  </p>
                </div>

                <FormField label="Name">
                  <input
                    value={draft.name}
                    onChange={(e) => set_draft((current) => ({ ...current, name: e.target.value }))}
                    className={input_class_name}
                    placeholder="Example: Twin-Strep tag"
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Type">
                    <select
                      value={draft.kind}
                      onChange={(e) =>
                        set_draft((current) => ({ ...current, kind: e.target.value as 'dna' | 'peptide' }))
                      }
                      className={input_class_name}
                    >
                      <option value="dna">DNA</option>
                      <option value="peptide">Peptide</option>
                    </select>
                  </FormField>

                  <FormField label="Category">
                    <select
                      value={draft.category}
                      onChange={(e) =>
                        set_draft((current) => ({ ...current, category: e.target.value as KnownSequenceCategory }))
                      }
                      className={input_class_name}
                    >
                      {category_options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label={draft.kind === 'dna' ? 'DNA sequence' : 'Peptide sequence'}>
                  <textarea
                    value={draft.sequence}
                    onChange={(e) => set_draft((current) => ({ ...current, sequence: e.target.value.toUpperCase() }))}
                    className={cn(input_class_name, 'min-h-28 resize-y font-mono text-xs')}
                    placeholder={draft.kind === 'dna' ? 'ATGGCC...' : 'WSHPQFEK'}
                  />
                </FormField>

                <FormField label="Description">
                  <textarea
                    value={draft.description}
                    onChange={(e) => set_draft((current) => ({ ...current, description: e.target.value }))}
                    className={cn(input_class_name, 'min-h-24 resize-y')}
                    placeholder="Short description shown in scan results"
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <FormField label="Feature type">
                    <input
                      value={draft.feature_type}
                      onChange={(e) => set_draft((current) => ({ ...current, feature_type: e.target.value }))}
                      className={input_class_name}
                      placeholder="misc_feature"
                    />
                  </FormField>

                  <FormField label="Color">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={colorToHex(draft.color)}
                        onChange={(e) => set_draft((current) => ({ ...current, color: hexToColor(e.target.value) }))}
                        className="border-border bg-background h-9 w-24 rounded-md border p-1"
                      />
                    </div>
                  </FormField>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveSequence}>
                    <Plus size={13} />
                    {editing_index !== null ? 'Update sequence' : 'Add sequence'}
                  </Button>
                  {editing_index !== null && (
                    <Button variant="outline" onClick={cancelEditing}>
                      <X size={13} />
                      Cancel edit
                    </Button>
                  )}
                  <Button variant="ghost" onClick={resetSettings}>
                    Reset to built-ins
                  </Button>
                </div>
              </div>

              <div className="border-border bg-card min-h-0 rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Custom sequences</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      This is the full sequence list used by the scanner once settings are saved.
                    </p>
                  </div>
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                    {settings.known_sequences.length} total
                  </span>
                </div>

                {settings.known_sequences.length > 0 ? (
                  <div className="space-y-3">
                    {settings.known_sequences.map((entry, index) => (
                      <SequenceCard
                        key={`${entry.name}:${entry.kind}:${entry.sequence}:${index}`}
                        entry={entry}
                        is_editing={editing_index === index}
                        onEdit={() => startEditing(index)}
                        onDelete={() => removeSequence(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground flex min-h-60 items-center justify-center rounded-lg border border-dashed text-sm">
                    No sequences configured.
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function SequenceCard({
  entry,
  is_editing,
  onEdit,
  onDelete,
}: {
  entry: KnownSequenceTarget;
  is_editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'border-border bg-muted/20 rounded-lg border p-4',
        is_editing && 'border-primary ring-primary/20 ring-2',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{entry.name}</h3>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium uppercase">
              {entry.kind}
            </span>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {entry.category}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{entry.description}</p>
          <div className="grid gap-2 text-xs md:grid-cols-3">
            <InlineDetail label="Sequence" value={entry.sequence} mono />
            <InlineDetail label="Feature type" value={entry.feature_type} />
            <ColorDetail color={entry.color} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} title="Edit sequence">
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Delete sequence">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
      {children}
    </label>
  );
}

function InlineDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
      <div className={cn('mt-1 text-sm font-semibold break-all', mono && 'font-mono text-xs')}>{value}</div>
    </div>
  );
}

function ColorDetail({ color }: { color: string }) {
  const hex_color = colorToHex(color);

  return (
    <div className="border-border bg-muted/30 rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Color</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="border-border size-4 rounded-full border" style={{ backgroundColor: hex_color }} />
        <span className="text-sm font-semibold">{hex_color}</span>
      </div>
    </div>
  );
}

const input_class_name =
  'border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2';
