import { ArrowLeft, ArrowRight, EyeOff, Pencil, Trash2, X, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '#/components/ui/button';
import { cn } from '#/lib/utils';
import { featureColorToCss, type Feature } from '#/lib/xdna-parser';

const TYPE_LABELS: Record<string, string> = {
  misc_feature: 'Misc',
  CDS: 'CDS',
  rep_origin: 'Origin',
  Promoter: 'Promoter',
  '': 'Unknown',
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

type Props = {
  features: Feature[];
  selectedFeature: number | null;
  onSelectFeature: (index: number | null) => void;
  onUpdateFeature: (index: number, next_feature: Feature) => void;
  onDeleteFeature: (index: number) => void;
  autoEditFeature?: number | null;
  onAutoEditHandled?: () => void;
};

type FeatureDraft = {
  name: string;
  type: string;
  start: string;
  end: string;
  strand: Feature['flags']['strand'];
  visible: boolean;
  color: string;
  description: string;
};

function featureToDraft(feature: Feature): FeatureDraft {
  return {
    name: feature.name,
    type: feature.type,
    start: String(feature.start),
    end: String(feature.end),
    strand: feature.flags.strand,
    visible: feature.flags.visible,
    color: feature.color,
    description: feature.description.replace(/\r/g, '\n'),
  };
}

function normalizeDescriptionLines(description: string): string[] {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePosition(value: string, fallback: number) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function colorStringToHex(color: string) {
  const parts = color
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 3) {
    return '#969696';
  }

  return `#${parts
    .slice(0, 3)
    .map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToColorString(value: string) {
  const normalized = value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '150,150,150,';
  }

  return `${Number.parseInt(normalized.slice(0, 2), 16)},${Number.parseInt(normalized.slice(2, 4), 16)},${Number.parseInt(normalized.slice(4, 6), 16)},`;
}

function FeatureSummary({ feature }: { feature: Feature }) {
  const length = Math.abs(feature.end - feature.start) + 1;

  return (
    <div className="text-muted-foreground grid gap-3 text-xs md:grid-cols-[minmax(0,1.7fr)_110px_130px_110px_100px]">
      <div className="min-w-0">
        <div className="text-foreground truncate font-medium">{feature.name || '(unnamed)'}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="bg-muted rounded-full px-2 py-0.5">{typeLabel(feature.type)}</span>
          {!feature.flags.visible && (
            <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5">
              <EyeOff size={11} /> Hidden
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="text-[10px] tracking-wider uppercase">Range</div>
        <div className="text-foreground mt-1 font-mono">
          {feature.start.toLocaleString()}-{feature.end.toLocaleString()}
        </div>
      </div>
      <div>
        <div className="text-[10px] tracking-wider uppercase">Strand</div>
        <div className="text-foreground mt-1 inline-flex items-center gap-1">
          {feature.flags.strand === 'forward' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
          {feature.flags.strand}
        </div>
      </div>
      <div>
        <div className="text-[10px] tracking-wider uppercase">Length</div>
        <div className="text-foreground mt-1">{length.toLocaleString()} bp</div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] tracking-wider uppercase">Notes</div>
        <div className="text-foreground mt-1 truncate">{feature.descriptionLines[0] ?? 'No description'}</div>
      </div>
    </div>
  );
}

function FeatureEditor({
  draft,
  onChange,
  onCancel,
  onDelete,
  onSave,
}: {
  draft: FeatureDraft;
  onChange: (next_draft: FeatureDraft) => void;
  onCancel: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  return (
    <div className="border-border bg-muted/30 space-y-3 rounded-b-xl border-t px-4 py-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_160px_120px_120px_140px_120px]">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Name</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className="border-border bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Type</span>
          <input
            value={draft.type}
            onChange={(e) => onChange({ ...draft, type: e.target.value })}
            className="border-border bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Start</span>
          <input
            value={draft.start}
            onChange={(e) => onChange({ ...draft, start: e.target.value })}
            className="border-border bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm outline-none"
            inputMode="numeric"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">End</span>
          <input
            value={draft.end}
            onChange={(e) => onChange({ ...draft, end: e.target.value })}
            className="border-border bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm outline-none"
            inputMode="numeric"
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Strand</span>
          <select
            value={draft.strand}
            onChange={(e) => onChange({ ...draft, strand: e.target.value === 'reverse' ? 'reverse' : 'forward' })}
            className="border-border bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm outline-none"
          >
            <option value="forward">Forward</option>
            <option value="reverse">Reverse</option>
          </select>
        </label>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Color</span>
          <div className="border-border bg-background flex h-9 items-center rounded-md border px-2">
            <input
              type="color"
              value={colorStringToHex(draft.color)}
              onChange={(e) => onChange({ ...draft, color: hexToColorString(e.target.value) })}
              className="h-6 max-w-22 rounded border-0 bg-transparent p-0"
            />
          </div>
        </div>
      </div>

      <label className="text-foreground flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.visible}
          onChange={(e) => onChange({ ...draft, visible: e.target.checked })}
        />
        Visible in viewer
      </label>

      <label className="space-y-1">
        <span className="text-muted-foreground text-xs font-medium">Description</span>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className="border-border bg-background text-foreground min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive mr-auto gap-1.5">
          <Trash2 size={13} />
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5">
          <X size={13} />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} className="gap-1.5">
          <Check size={13} />
          Save
        </Button>
      </div>
    </div>
  );
}

export function FeatureList({
  features,
  selectedFeature,
  onSelectFeature,
  onUpdateFeature,
  onDeleteFeature,
  autoEditFeature,
  onAutoEditHandled,
}: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<FeatureDraft | null>(null);
  const item_ref_map = useRef(new Map<number, HTMLElement>());

  const feature_by_index = useMemo(() => new Map(features.map((feature) => [feature.index, feature])), [features]);

  useEffect(() => {
    if (editing === null) {
      return;
    }

    const feature = feature_by_index.get(editing);
    if (!feature) {
      setEditing(null);
      setDraft(null);
      return;
    }

    setDraft(featureToDraft(feature));
  }, [editing, feature_by_index]);

  useEffect(() => {
    if (autoEditFeature == null) {
      return;
    }

    const feature = feature_by_index.get(autoEditFeature);
    if (!feature) {
      return;
    }

    setEditing(feature.index);
    setDraft(featureToDraft(feature));
    onSelectFeature(feature.index);
    onAutoEditHandled?.();
  }, [autoEditFeature, feature_by_index, onAutoEditHandled, onSelectFeature]);

  useEffect(() => {
    if (editing == null) {
      return;
    }

    const element = item_ref_map.current.get(editing);
    if (!element) {
      return;
    }

    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const input = element.querySelector<HTMLInputElement>('input, textarea, select');
    input?.focus();
  }, [editing]);

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  function saveEdit(feature: Feature) {
    if (!draft) {
      return;
    }

    const description_lines = normalizeDescriptionLines(draft.description);
    const next_feature: Feature = {
      ...feature,
      name: draft.name.trim(),
      type: draft.type.trim(),
      start: parsePosition(draft.start, feature.start),
      end: parsePosition(draft.end, feature.end),
      description: description_lines.join('\r'),
      descriptionLines: description_lines,
      color: draft.color.trim() || feature.color,
      flags: {
        ...feature.flags,
        strand: draft.strand,
        rawStrand: draft.strand === 'forward' ? 1 : 0,
        visible: draft.visible,
        rawVisible: draft.visible ? 1 : 0,
      },
    };

    onUpdateFeature(feature.index, next_feature);
    setEditing(null);
    setDraft(null);
  }

  if (features.length === 0) {
    return (
      <div className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm">
        No features annotated yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {features.map((feature) => {
        const color = featureColorToCss(feature.color);
        const is_selected = selectedFeature === feature.index;
        const is_editing = editing === feature.index && draft !== null;

        return (
          <section
            key={feature.index}
            ref={(node) => {
              if (node) {
                item_ref_map.current.set(feature.index, node);
              } else {
                item_ref_map.current.delete(feature.index);
              }
            }}
            className={cn(
              'overflow-hidden rounded-xl border bg-card transition-colors',
              is_selected ? 'border-primary/50 shadow-sm' : 'border-border',
            )}
          >
            <div
              className={cn('flex items-start gap-3 px-4 py-3', !is_editing && 'cursor-pointer hover:bg-muted/30')}
              onClick={() => {
                if (is_editing) {
                  return;
                }

                onSelectFeature(is_selected ? null : feature.index);
              }}
            >
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <FeatureSummary feature={feature} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Edit feature"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(feature.index);
                    setDraft(featureToDraft(feature));
                    onSelectFeature(feature.index);
                  }}
                >
                  <Pencil size={13} />
                </Button>
              </div>
            </div>

            {is_editing && draft && (
              <FeatureEditor
                draft={draft}
                onChange={setDraft}
                onCancel={cancelEdit}
                onDelete={() => onDeleteFeature(feature.index)}
                onSave={() => saveEdit(feature)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
