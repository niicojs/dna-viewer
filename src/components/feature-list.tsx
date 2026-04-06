import { ArrowRight, ArrowLeft, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '#/lib/utils';
import type { Feature } from '#/lib/xdna-parser';
import { featureColorToCss } from '#/lib/xdna-parser';

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

function feature_to_draft(feature: Feature): FeatureDraft {
  return {
    name: feature.name,
    type: feature.type,
    start: String(feature.start),
    end: String(feature.end),
    strand: feature.flags.strand,
    visible: feature.flags.visible,
    color: feature.color,
    description: feature.description,
  };
}

function normalize_description_lines(description: string): string[] {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parse_position(value: string, fallback: number) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function color_string_to_hex(color: string) {
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

function hex_to_color_string(value: string) {
  const normalized = value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '150,150,150,';
  }

  return `${Number.parseInt(normalized.slice(0, 2), 16)},${Number.parseInt(normalized.slice(2, 4), 16)},${Number.parseInt(normalized.slice(4, 6), 16)},`;
}

export function FeatureList({
  features,
  selectedFeature,
  onSelectFeature,
  onUpdateFeature,
  autoEditFeature,
  onAutoEditHandled,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<FeatureDraft | null>(null);

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

    setDraft(feature_to_draft(feature));
  }, [editing, feature_by_index]);

  useEffect(() => {
    if (autoEditFeature == null) {
      return;
    }

    const feature = feature_by_index.get(autoEditFeature);
    if (!feature) {
      return;
    }

    start_edit(feature);
    onSelectFeature(feature.index);
    onAutoEditHandled?.();
  }, [autoEditFeature, feature_by_index, onAutoEditHandled, onSelectFeature]);

  function start_edit(feature: Feature) {
    setExpanded(feature.index);
    setEditing(feature.index);
    setDraft(feature_to_draft(feature));
  }

  function cancel_edit() {
    setEditing(null);
    setDraft(null);
  }

  function save_edit(feature: Feature) {
    if (!draft) {
      return;
    }

    const description_lines = normalize_description_lines(draft.description);
    const next_feature: Feature = {
      ...feature,
      name: draft.name.trim(),
      type: draft.type.trim(),
      start: parse_position(draft.start, feature.start),
      end: parse_position(draft.end, feature.end),
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
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-sm">
        No features annotated
      </div>
    );
  }

  return (
    <div className="divide-border flex flex-col divide-y text-sm">
      {features.map((f) => {
        const color = featureColorToCss(f.color);
        const isSelected = selectedFeature === f.index;
        const isExpanded = expanded === f.index;
        const isEditing = editing === f.index && draft !== null;
        const length = Math.abs(f.end - f.start) + 1;

        return (
          <div key={f.index}>
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
              )}
              onClick={() => {
                onSelectFeature(isSelected ? null : f.index);
                if (!isSelected) setExpanded(f.index);
              }}
            >
              {/* Color swatch */}
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} />

              {/* Name */}
              <span className="min-w-0 flex-1 truncate font-medium">{f.name || '(unnamed)'}</span>

              {/* Strand arrow */}
              <span className="text-muted-foreground shrink-0">
                {f.flags.strand === 'forward' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
              </span>

              {/* Visibility */}
              {!f.flags.visible && (
                <span className="text-muted-foreground shrink-0">
                  <EyeOff size={12} />
                </span>
              )}

              {/* Expand chevron */}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded px-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  start_edit(f);
                }}
              >
                Edit
              </button>

              <button
                type="button"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(isExpanded ? null : f.index);
                }}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div
                className="bg-muted/30 text-muted-foreground space-y-1 border-l-2 px-4 py-2.5 text-xs"
                style={{ borderLeftColor: color }}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">Name</span>
                        <input
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">Type</span>
                        <input
                          value={draft.type}
                          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">Start</span>
                        <input
                          value={draft.start}
                          onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">End</span>
                        <input
                          value={draft.end}
                          onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">Strand</span>
                        <select
                          value={draft.strand}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              strand: e.target.value === 'reverse' ? 'reverse' : 'forward',
                            })
                          }
                          className="border-border bg-background text-foreground w-full rounded border px-2 py-1"
                        >
                          <option value="forward">Forward</option>
                          <option value="reverse">Reverse</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-foreground/70 font-semibold">Color</span>
                        <input
                          type="color"
                          value={color_string_to_hex(draft.color)}
                          onChange={(e) => setDraft({ ...draft, color: hex_to_color_string(e.target.value) })}
                          className="border-border bg-background h-9 w-full rounded border px-1 py-1"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.visible}
                        onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
                      />
                      <span className="text-foreground/70 font-semibold">Visible</span>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-foreground/70 font-semibold">Description</span>
                      <textarea
                        value={draft.description.replace(/\r/g, '\n')}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        className="border-border bg-background text-foreground min-h-20 w-full rounded border px-2 py-1"
                      />
                    </label>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="border-border hover:bg-background rounded border px-2 py-1"
                        onClick={cancel_edit}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="bg-primary text-primary-foreground rounded px-2 py-1"
                        onClick={() => save_edit(f)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                      <span className="text-foreground/70 font-semibold">Type</span>
                      <span>{typeLabel(f.type)}</span>
                      <span className="text-foreground/70 font-semibold">Position</span>
                      <span>
                        {f.start.toLocaleString()} → {f.end.toLocaleString()}
                      </span>
                      <span className="text-foreground/70 font-semibold">Length</span>
                      <span>{length.toLocaleString()} bp</span>
                      <span className="text-foreground/70 font-semibold">Strand</span>
                      <span className="flex items-center gap-1">
                        {f.flags.strand === 'forward' ? (
                          <>
                            <ArrowRight size={10} /> forward
                          </>
                        ) : (
                          <>
                            <ArrowLeft size={10} /> reverse
                          </>
                        )}
                      </span>
                    </div>
                    {f.descriptionLines.length > 0 && (
                      <div className="border-border mt-1.5 border-t pt-1.5">
                        {f.descriptionLines.map((line, i) => (
                          <p key={i} className="leading-relaxed break-all">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
