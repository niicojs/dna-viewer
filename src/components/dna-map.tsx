import { useState } from 'react';

import type { Feature, XdnaFile } from '#/lib/xdna-parser';
import { featureColorToCss } from '#/lib/xdna-parser';

const CX = 200;
const CY = 200;
const R_BACKBONE = 110;
const R_FEATURE_INNER = 120;
const R_FEATURE_OUTER = 148;
const R_LABEL = 162;
const R_TICK = 108;

function polarToXY(angle: number, r: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function featureArc(start: number, end: number, total: number, rInner: number, rOuter: number): string {
  const startAngle = (start / total) * 360;
  let endAngle = (end / total) * 360;

  // Handle wrap-around features (end < start for circular)
  if (end < start) endAngle += 360;

  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  const s1 = polarToXY(startAngle, rOuter);
  const e1 = polarToXY(endAngle, rOuter);
  const s2 = polarToXY(endAngle, rInner);
  const e2 = polarToXY(startAngle, rInner);

  return [
    `M ${s1.x} ${s1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ');
}

function arrowPath(end: number, total: number, _strand: 'forward' | 'reverse', rOuter: number) {
  const angle = (end / total) * 360;
  const tip = polarToXY(angle, rOuter + 6);
  const base1 = polarToXY(angle - 2, rOuter);
  const base2 = polarToXY(angle - 2, rOuter - 10);
  return `M ${base1.x} ${base1.y} L ${tip.x} ${tip.y} L ${base2.x} ${base2.y} Z`;
}

type Props = {
  xdna: XdnaFile;
  selectedFeature: number | null;
  onSelectFeature: (index: number | null) => void;
};

export function PlasmidMap({ xdna, selectedFeature, onSelectFeature }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = xdna.header.sequenceLength;
  const features = xdna.annotations?.features ?? [];

  // Tick marks every 500 bp (or fewer for shorter sequences)
  const tickInterval = total <= 2000 ? 100 : total <= 5000 ? 500 : 1000;
  const ticks: number[] = [];
  for (let t = 0; t < total; t += tickInterval) ticks.push(t);

  return (
    <svg viewBox="0 0 400 400" className="plasmid-svg select-none" aria-label="Plasmid map">
      {/* Backbone circle */}
      <circle cx={CX} cy={CY} r={R_BACKBONE} fill="none" stroke="var(--border)" strokeWidth={3} />

      {/* Tick marks */}
      {ticks.map((t) => {
        const angle = (t / total) * 360;
        const outer = polarToXY(angle, R_TICK);
        const inner = polarToXY(angle, R_TICK - 6);
        const label = polarToXY(angle, R_TICK - 16);
        return (
          <g key={t}>
            <line
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
            />
            {t % (tickInterval * 5) === 0 && (
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7}
                fill="var(--muted-foreground)"
              >
                {t}
              </text>
            )}
          </g>
        );
      })}

      {/* Features */}
      {features.map((f) => {
        const color = featureColorToCss(f.color);
        const isSelected = selectedFeature === f.index;
        const isHovered = hovered === f.index;
        const rInner = f.flags.strand === 'forward' ? R_FEATURE_INNER : R_FEATURE_INNER - 14;
        const rOuter = f.flags.strand === 'forward' ? R_FEATURE_OUTER : R_FEATURE_INNER - 2;

        const midAngle = ((f.start + f.end) / 2 / total) * 360;
        const labelPos = polarToXY(midAngle, R_LABEL);

        const arcEnd = f.end < f.start ? f.end + total : f.end;
        const sweep = ((arcEnd - f.start) / total) * 360;
        const showLabel = sweep > 8;

        return (
          <g
            key={f.index}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectFeature(isSelected ? null : f.index)}
            onMouseEnter={() => setHovered(f.index)}
            onMouseLeave={() => setHovered(null)}
          >
            <path
              d={featureArc(f.start, f.end, total, rInner, rOuter)}
              fill={color}
              fillOpacity={isSelected ? 1 : isHovered ? 0.85 : 0.7}
              stroke={isSelected ? 'var(--foreground)' : 'transparent'}
              strokeWidth={isSelected ? 1.5 : 0}
            />
            {f.flags.arrow && (
              <path
                d={arrowPath(f.end, total, f.flags.strand, rOuter)}
                fill={color}
                fillOpacity={isSelected ? 1 : 0.8}
              />
            )}
            {showLabel && (
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={6.5}
                fontWeight={isSelected ? '700' : '500'}
                fill="var(--foreground)"
                style={{ pointerEvents: 'none' }}
              >
                {f.name.length > 14 ? f.name.slice(0, 13) + '…' : f.name}
              </text>
            )}
          </g>
        );
      })}

      {/* Center info */}
      <text x={CX} y={CY - 10} textAnchor="middle" fontSize={11} fontWeight="600" fill="var(--foreground)">
        {xdna.file.name.replace(/\.xdna$/i, '')}
      </text>
      <text x={CX} y={CY + 6} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
        {total.toLocaleString()} bp
      </text>
      <text x={CX} y={CY + 19} textAnchor="middle" fontSize={8} fill="var(--muted-foreground)">
        {xdna.header.topology}
      </text>
    </svg>
  );
}

export function LinearMap({ xdna, selectedFeature, onSelectFeature }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = xdna.header.sequenceLength;
  const features = xdna.annotations?.features ?? [];
  const W = 640;
  const LANE_H = 16;
  const TRACK_Y = 40;
  const RULER_Y = 20;

  // Assign lanes to avoid overlap
  const lanes: Array<{ f: Feature; lane: number }> = [];
  const laneEnds: number[] = [];

  for (const f of features) {
    const start = Math.min(f.start, f.end);
    const end = Math.max(f.start, f.end);
    const x1 = (start / total) * W;
    const x2 = (end / total) * W;

    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > x1) lane++;
    laneEnds[lane] = x2;
    lanes.push({ f, lane });
  }

  const maxLane = lanes.reduce((m, l) => Math.max(m, l.lane), 0);
  const totalH = TRACK_Y + (maxLane + 1) * (LANE_H + 4) + 20;

  const tickInterval = total <= 1000 ? 100 : total <= 5000 ? 500 : 1000;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += tickInterval) ticks.push(t);

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ height: totalH }} aria-label="Linear map">
      {/* Ruler */}
      <line x1={0} y1={RULER_Y} x2={W} y2={RULER_Y} stroke="var(--border)" strokeWidth={1.5} />
      {ticks.map((t) => {
        const x = (t / total) * W;
        return (
          <g key={t}>
            <line x1={x} y1={RULER_Y - 4} x2={x} y2={RULER_Y + 4} stroke="var(--muted-foreground)" strokeWidth={1} />
            <text x={x} y={RULER_Y - 7} textAnchor="middle" fontSize={7} fill="var(--muted-foreground)">
              {t > 0 ? t.toLocaleString() : ''}
            </text>
          </g>
        );
      })}

      {/* Features */}
      {lanes.map(({ f, lane }) => {
        const start = Math.min(f.start, f.end);
        const end = Math.max(f.start, f.end);
        const x = (start / total) * W;
        const w = Math.max(((end - start) / total) * W, 2);
        const y = TRACK_Y + lane * (LANE_H + 4);
        const color = featureColorToCss(f.color);
        const isSelected = selectedFeature === f.index;
        const isHovered = hovered === f.index;

        return (
          <g
            key={f.index}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectFeature(isSelected ? null : f.index)}
            onMouseEnter={() => setHovered(f.index)}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={LANE_H}
              fill={color}
              fillOpacity={isSelected ? 1 : isHovered ? 0.85 : 0.65}
              rx={3}
              stroke={isSelected ? 'var(--foreground)' : 'transparent'}
              strokeWidth={isSelected ? 1.5 : 0}
            />
            {w > 30 && (
              <text
                x={x + w / 2}
                y={y + LANE_H / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7}
                fontWeight="600"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                {f.name.length > Math.floor(w / 5) ? f.name.slice(0, Math.floor(w / 5) - 1) + '…' : f.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
