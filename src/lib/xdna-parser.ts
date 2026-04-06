/**
 * Browser-native XDNA parser using DataView / Uint8Array instead of Node's Buffer.
 * All logic mirrors src/lib/xdna.ts but works in browser environments.
 */

const HEADER_SIZE = 112;

const decoder = new TextDecoder('latin1');

function fail(message: string): never {
  throw new Error(message);
}

function assertRange(view: DataView, offset: number, length: number, label: string) {
  if (offset < 0 || length < 0 || offset + length > view.byteLength) {
    fail(`Cannot read ${label} at offset ${offset} (length ${length}, file size ${view.byteLength})`);
  }
}

function readUInt32BE(view: DataView, offset: number, label: string): number {
  assertRange(view, offset, 4, label);
  return view.getUint32(offset, false); // big-endian
}

function readLatin1(view: DataView, start: number, end: number): string {
  return decoder.decode(new Uint8Array(view.buffer, view.byteOffset + start, end - start));
}

function readPascalString(view: DataView, offset: number, label: string) {
  assertRange(view, offset, 1, `${label} length`);
  const length = view.getUint8(offset);
  const start = offset + 1;
  assertRange(view, start, length, label);
  return {
    value: readLatin1(view, start, start + length),
    nextOffset: start + length,
    length,
  };
}

function parseIntegerString(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    fail(`Invalid numeric string for ${label}: ${JSON.stringify(value)}`);
  }
  return Number.parseInt(trimmed, 10);
}

function parseOverhang(view: DataView, offset: number, side: 'left' | 'right') {
  const lengthField = readPascalString(view, offset, `${side} overhang length`);
  const declaredLength = parseIntegerString(lengthField.value || '0', `${side} overhang length`);
  const sequenceLength = Math.abs(declaredLength);

  if (sequenceLength === 0) {
    return {
      overhang: { side, type: 'none' as const, declaredLength, sequence: '' },
      nextOffset: lengthField.nextOffset,
    };
  }

  assertRange(view, lengthField.nextOffset, sequenceLength, `${side} overhang sequence`);
  const sequence = readLatin1(view, lengthField.nextOffset, lengthField.nextOffset + sequenceLength);

  return {
    overhang: {
      side,
      type: (declaredLength > 0 ? "5'" : "3'") as "5'" | "3'",
      declaredLength,
      sequence,
    },
    nextOffset: lengthField.nextOffset + sequenceLength,
  };
}

export type Feature = {
  index: number;
  name: string;
  description: string;
  descriptionLines: string[];
  type: string;
  start: number;
  end: number;
  flags: {
    strand: 'forward' | 'reverse';
    rawStrand: number;
    visible: boolean;
    rawVisible: number;
    unknown: number;
    arrow: boolean;
    rawArrow: number;
  };
  color: string;
};

export type Overhang = {
  side: 'left' | 'right';
  type: 'none' | "5'" | "3'";
  declaredLength: number;
  sequence: string;
};

export type XdnaFile = {
  file: { size: number; format: 'XDNA'; name: string };
  header: {
    version: number;
    sequenceType: string;
    rawSequenceType: number;
    topology: 'linear' | 'circular' | string;
    rawTopology: number;
    sequenceLength: number;
    negativeLength: number;
    commentLength: number;
    terminator: number;
  };
  offsets: {
    header: { start: number; end: number };
    sequence: { start: number; end: number };
    comment: { start: number; end: number };
    annotations: { start: number; end: number } | null;
  };
  sequence: string;
  comment: string;
  annotations: {
    marker: number;
    rightOverhang: Overhang;
    leftOverhang: Overhang;
    featureCount: number;
    features: Feature[];
    trailingBytes: number;
  } | null;
};

function parseFeature(view: DataView, offset: number, index: number): { feature: Feature; nextOffset: number } {
  const nameField = readPascalString(view, offset, `feature ${index} name`);
  const descriptionField = readPascalString(view, nameField.nextOffset, `feature ${index} description`);
  const typeField = readPascalString(view, descriptionField.nextOffset, `feature ${index} type`);
  const startField = readPascalString(view, typeField.nextOffset, `feature ${index} start`);
  const endField = readPascalString(view, startField.nextOffset, `feature ${index} end`);

  assertRange(view, endField.nextOffset, 4, `feature ${index} flags`);
  const flagsOffset = endField.nextOffset;
  const strandFlag = view.getUint8(flagsOffset);
  const displayFlag = view.getUint8(flagsOffset + 1);
  const unknownFlag = view.getUint8(flagsOffset + 2);
  const arrowFlag = view.getUint8(flagsOffset + 3);

  const colorField = readPascalString(view, flagsOffset + 4, `feature ${index} color`);
  const descriptionParts = descriptionField.value.split('\r').filter(Boolean);

  return {
    feature: {
      index,
      name: nameField.value,
      description: descriptionField.value,
      descriptionLines: descriptionParts,
      type: typeField.value,
      start: parseIntegerString(startField.value, `feature ${index} start`),
      end: parseIntegerString(endField.value, `feature ${index} end`),
      flags: {
        strand: strandFlag === 0 ? 'reverse' : 'forward',
        rawStrand: strandFlag,
        visible: displayFlag !== 0,
        rawVisible: displayFlag,
        unknown: unknownFlag,
        arrow: arrowFlag !== 0,
        rawArrow: arrowFlag,
      },
      color: colorField.value,
    },
    nextOffset: colorField.nextOffset,
  };
}

function parseSequenceType(value: number): string {
  if (value === 1) return 'DNA';
  if (value === 2) return 'degenerated DNA';
  if (value === 3) return 'RNA';
  if (value === 4) return 'protein';
  return `unknown(${value})`;
}

function parseTopology(value: number): 'linear' | 'circular' | string {
  if (value === 0) return 'linear';
  if (value === 1) return 'circular';
  return `unknown(${value})`;
}

/** Parse an XDNA file from an ArrayBuffer (e.g. from FileReader). */
export function parseXdnaBuffer(buffer: ArrayBuffer, fileName = 'unknown.xdna'): XdnaFile {
  const view = new DataView(buffer);

  if (view.byteLength < HEADER_SIZE) {
    fail(`File is too short for an XDNA header (${view.byteLength} bytes)`);
  }

  const sequenceLength = readUInt32BE(view, 28, 'sequence length');
  const negativeLength = readUInt32BE(view, 32, 'negative length');
  const commentLength = readUInt32BE(view, 96, 'comment length');

  const sequenceOffset = HEADER_SIZE;
  const commentOffset = sequenceOffset + sequenceLength;

  assertRange(view, sequenceOffset, sequenceLength, 'sequence');
  assertRange(view, commentOffset, commentLength, 'comment');

  const sequence = readLatin1(view, sequenceOffset, commentOffset);
  const comment = readLatin1(view, commentOffset, commentOffset + commentLength);

  let offset = commentOffset + commentLength;
  let annotations: XdnaFile['annotations'] = null;

  if (offset < view.byteLength) {
    assertRange(view, offset, 1, 'annotation marker');
    const marker = view.getUint8(offset);
    offset += 1;

    const rightOverhang = parseOverhang(view, offset, 'right');
    offset = rightOverhang.nextOffset;

    const leftOverhang = parseOverhang(view, offset, 'left');
    offset = leftOverhang.nextOffset;

    assertRange(view, offset, 1, 'feature count');
    const featureCount = view.getUint8(offset);
    offset += 1;

    const features: Feature[] = [];
    for (let i = 0; i < featureCount; i++) {
      const parsed = parseFeature(view, offset, i + 1);
      features.push(parsed.feature);
      offset = parsed.nextOffset;
    }

    annotations = {
      marker,
      rightOverhang: rightOverhang.overhang,
      leftOverhang: leftOverhang.overhang,
      featureCount,
      features,
      trailingBytes: view.byteLength - offset,
    };
  }

  return {
    file: { size: view.byteLength, format: 'XDNA', name: fileName },
    header: {
      version: view.getUint8(0),
      sequenceType: parseSequenceType(view.getUint8(1)),
      rawSequenceType: view.getUint8(1),
      topology: parseTopology(view.getUint8(2)),
      rawTopology: view.getUint8(2),
      sequenceLength,
      negativeLength,
      commentLength,
      terminator: view.getUint8(111),
    },
    offsets: {
      header: { start: 0, end: HEADER_SIZE },
      sequence: { start: sequenceOffset, end: commentOffset },
      comment: { start: commentOffset, end: commentOffset + commentLength },
      annotations: annotations ? { start: commentOffset + commentLength, end: view.byteLength } : null,
    },
    sequence,
    comment,
    annotations,
  };
}

/** Parse the color string "R,G,B," → CSS rgb() */
export function featureColorToCss(color: string): string {
  const parts = color
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return `rgb(${parts[0]},${parts[1]},${parts[2]})`;
  return 'rgb(150,150,150)';
}

/** Load an XDNA File object from a browser File input / drag-drop. */
export function readXdnaFile(file: File): Promise<XdnaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseXdnaBuffer(reader.result as ArrayBuffer, file.name);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
