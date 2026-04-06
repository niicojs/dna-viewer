import { useMemo, useState } from 'react';

import { cn } from '#/lib/utils';
import type { Feature } from '#/lib/xdna-parser';
import { featureColorToCss } from '#/lib/xdna-parser';

const BASES_PER_LINE = 60;
const GROUP_SIZE = 10;

function baseClass(base: string): string {
  switch (base.toUpperCase()) {
    case 'A':
      return 'base-A';
    case 'T':
      return 'base-T';
    case 'G':
      return 'base-G';
    case 'C':
      return 'base-C';
    default:
      return '';
  }
}

type FeatureRange = {
  start: number; // 0-indexed
  end: number; // 0-indexed inclusive
  color: string;
  name: string;
};

type Props = {
  sequence: string;
  features?: Feature[];
  selectedFeature?: number | null;
};

export function SequenceViewer({ sequence, features = [], selectedFeature }: Props) {
  const [colorize, setColorize] = useState(true);
  const [showFeatureHighlights, setShowFeatureHighlights] = useState(true);

  const featureRanges: FeatureRange[] = useMemo(
    () =>
      features
        .filter((f) => f.flags.visible)
        .map((f) => ({
          start: Math.min(f.start, f.end) - 1,
          end: Math.max(f.start, f.end) - 1,
          color: featureColorToCss(f.color),
          name: f.name,
        })),
    [features],
  );

  const selectedRange: FeatureRange | null = useMemo(() => {
    if (!selectedFeature) return null;
    const f = features.find((x) => x.index === selectedFeature);
    if (!f) return null;
    return {
      start: Math.min(f.start, f.end) - 1,
      end: Math.max(f.start, f.end) - 1,
      color: featureColorToCss(f.color),
      name: f.name,
    };
  }, [features, selectedFeature]);

  const lines = useMemo(() => {
    const result: Array<{ pos: number; bases: string[] }> = [];
    for (let i = 0; i < sequence.length; i += BASES_PER_LINE) {
      result.push({
        pos: i + 1,
        bases: sequence.slice(i, i + BASES_PER_LINE).split(''),
      });
    }
    return result;
  }, [sequence]);

  function getBaseHighlight(absIdx: number): string | null {
    if (!showFeatureHighlights) return null;
    if (selectedRange && absIdx >= selectedRange.start && absIdx <= selectedRange.end) {
      return selectedRange.color;
    }
    for (const r of featureRanges) {
      if (absIdx >= r.start && absIdx <= r.end) return r.color;
    }
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={colorize}
            onChange={(e) => setColorize(e.target.checked)}
            className="accent-primary"
          />
          Color bases
        </label>
        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={showFeatureHighlights}
            onChange={(e) => setShowFeatureHighlights(e.target.checked)}
            className="accent-primary"
          />
          Highlight features
        </label>
        <span className="text-muted-foreground ml-auto text-xs">{sequence.length.toLocaleString()} bp</span>
      </div>

      {/* Sequence */}
      <div className="seq-block flex-1 overflow-auto">
        {lines.map(({ pos, bases }) => (
          <div key={pos} className="seq-line">
            <span className="seq-pos">{pos}</span>
            <span className="seq-bases">
              {bases.map((base, i) => {
                const absIdx = pos - 1 + i;
                const highlight = getBaseHighlight(absIdx);
                const spacer = i > 0 && i % GROUP_SIZE === 0;

                return (
                  <span key={i}>
                    {spacer && <span className="inline-block w-2" />}
                    <span
                      className={cn(colorize ? baseClass(base) : '')}
                      style={
                        highlight
                          ? {
                              backgroundColor: highlight + '33',
                              borderBottom: `2px solid ${highlight}`,
                            }
                          : undefined
                      }
                    >
                      {base}
                    </span>
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
