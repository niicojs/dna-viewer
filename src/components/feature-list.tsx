import { ArrowRight, ArrowLeft, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

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
};

export function FeatureList({ features, selectedFeature, onSelectFeature }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
