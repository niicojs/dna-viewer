/**
 * Converts a parsed XdnaFile into the props expected by seqviz's <SeqViz>.
 *
 * Key mapping notes:
 * - XDNA features use 1-based inclusive [start, end].
 * - SeqViz annotations use 0-based, start inclusive / end exclusive → subtract 1 from start, keep end as-is.
 * - XDNA strand: 'forward' → direction 1, 'reverse' → direction -1.
 * - XDNA color: "R,G,B," string → "rgb(R,G,B)".
 */

import type { AnnotationProp } from 'seqviz/dist/elements';

import type { XdnaFile } from '#/lib/xdna-parser';

export type SeqVizInput = {
  name: string;
  seq: string;
  annotations: AnnotationProp[];
  topology: 'circular' | 'linear';
};

/** Convert "R,G,B," → "rgb(R,G,B)" */
function xdnaColorToRgb(color: string): string {
  const parts = color
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  return '#999999';
}

export function xdnaToSeqViz(xdna: XdnaFile): SeqVizInput {
  const annotations: AnnotationProp[] = (xdna.annotations?.features ?? [])
    .filter((f) => f.flags.visible)
    .map((f) => {
      // XDNA: 1-based inclusive [start, end]
      // SeqViz: 0-based, start inclusive, end exclusive
      // Wrap-around features (end < start) are kept as-is — seqviz handles them natively
      const start = Math.min(f.start, f.end) - 1;
      const end = Math.max(f.start, f.end); // end is already exclusive after +0 from 1-based

      return {
        name: f.name || '(unnamed)',
        start,
        end,
        direction: f.flags.strand === 'forward' ? 1 : -1,
        color: xdnaColorToRgb(f.color),
      } satisfies AnnotationProp;
    });

  const topology = xdna.header.topology === 'circular' ? 'circular' : 'linear';
  const name = xdna.file.name.replace(/\.xdna$/i, '');

  return { name, seq: xdna.sequence, annotations, topology };
}
