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

function encodeLatin1(value: string, label: string): Uint8Array {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0xff) {
      fail(`${label} contains unsupported non-Latin-1 characters`);
    }

    bytes[index] = code;
  }

  return bytes;
}

function encodePascalString(value: string, label: string): Uint8Array {
  const bytes = encodeLatin1(value, label);
  if (bytes.length > 0xff) {
    fail(`${label} is too long for XDNA (${bytes.length} bytes, max 255)`);
  }

  const result = new Uint8Array(bytes.length + 1);
  result[0] = bytes.length;
  result.set(bytes, 1);
  return result;
}

function writeUint32Be(target: Uint8Array, offset: number, value: number) {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(offset, value, false);
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
  file: { size: number; format: 'XDNA' | 'TXT' | 'FASTA'; name: string };
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

function parseFastaText(text: string): { sequence: string; comment: string } {
  const lines = text.split(/\r\n|\n|\r/);
  const header_line = lines[0]?.trim();

  if (!header_line?.startsWith('>')) {
    fail('FASTA file must start with a header line beginning with ">"');
  }

  const comment = header_line.slice(1).trim();
  const sequence_lines: string[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const trimmed_line = lines[index]?.trim() ?? '';

    if (!trimmed_line) continue;

    if (trimmed_line.startsWith('>')) {
      fail('FASTA file contains multiple sequence records; only single-record FASTA is supported');
    }

    sequence_lines.push(trimmed_line);
  }

  const sequence = sequence_lines.join('').toUpperCase();

  if (!sequence) {
    fail('FASTA file does not contain a sequence');
  }

  if (!/^[ACGTRYSWKMBDHVNUX*.-]+$/i.test(sequence)) {
    fail('FASTA file contains unsupported characters');
  }

  return { sequence, comment };
}

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
export function parseDnaText(text: string, fileName = 'unknown.txt', fileSize = text.length): XdnaFile {
  const normalized_text = text.replace(/^\uFEFF/, '');
  const is_fasta = normalized_text.startsWith('>');
  const { sequence, comment } = is_fasta
    ? parseFastaText(normalized_text)
    : { sequence: normalized_text.replace(/\s+/g, '').toUpperCase(), comment: '' };

  if (!sequence) fail('DNA text file is empty');
  if (!is_fasta && !/^[ACGTRYSWKMBDHVNUX*.-]+$/i.test(sequence)) fail('DNA text file contains unsupported characters');

  return {
    file: { size: fileSize, format: is_fasta ? 'FASTA' : 'TXT', name: fileName },
    header: {
      version: 0,
      sequenceType: 'DNA',
      rawSequenceType: 1,
      topology: 'circular',
      rawTopology: 0,
      sequenceLength: sequence.length,
      negativeLength: 0,
      commentLength: comment.length,
      terminator: 0,
    },
    offsets: {
      header: { start: 0, end: 0 },
      sequence: { start: 0, end: sequence.length },
      comment: { start: sequence.length, end: sequence.length + comment.length },
      annotations: null,
    },
    sequence,
    comment,
    annotations: null,
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

export async function readSequenceFile(file: File): Promise<XdnaFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xdna')) return readXdnaFile(file);

  const text = await file.text();
  return parseDnaText(text, file.name, file.size);
}

function normalizeOverhangLength(overhang: Overhang): number {
  if (overhang.type === 'none' || !overhang.sequence) {
    return 0;
  }

  if (overhang.declaredLength !== 0) {
    return overhang.declaredLength;
  }

  return overhang.type === "5'" ? overhang.sequence.length : -overhang.sequence.length;
}

function serializeOverhang(overhang: Overhang, label: string): Uint8Array {
  const declared_length = normalizeOverhangLength(overhang);
  const length_field = encodePascalString(String(declared_length), `${label} length`);
  const sequence = declared_length === 0 ? new Uint8Array(0) : encodeLatin1(overhang.sequence, `${label} sequence`);

  if (Math.abs(declared_length) !== sequence.length) {
    fail(`${label} length does not match its sequence`);
  }

  const result = new Uint8Array(length_field.length + sequence.length);
  result.set(length_field, 0);
  result.set(sequence, length_field.length);
  return result;
}

function serializeFeature(feature: Feature, index: number): Uint8Array {
  const parts = [
    encodePascalString(feature.name, `feature ${index} name`),
    encodePascalString(feature.description, `feature ${index} description`),
    encodePascalString(feature.type, `feature ${index} type`),
    encodePascalString(String(feature.start), `feature ${index} start`),
    encodePascalString(String(feature.end), `feature ${index} end`),
    Uint8Array.of(feature.flags.rawStrand, feature.flags.rawVisible, feature.flags.unknown, feature.flags.rawArrow),
    encodePascalString(feature.color, `feature ${index} color`),
  ];

  const total_length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total_length);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

export function serializeDNAFile(xdna: XdnaFile): Uint8Array {
  const sequence = encodeLatin1(xdna.sequence, 'sequence');
  const comment = encodeLatin1(xdna.comment, 'comment');
  const annotations = xdna.annotations;
  const features = annotations?.features ?? [];

  if (features.length > 0xff) {
    fail(`Too many features for XDNA (${features.length}, max 255)`);
  }

  const annotation_parts = annotations
    ? [
        Uint8Array.of(annotations.marker),
        serializeOverhang(annotations.rightOverhang, 'right overhang'),
        serializeOverhang(annotations.leftOverhang, 'left overhang'),
        Uint8Array.of(features.length),
        ...features.map((feature, index) => serializeFeature(feature, index + 1)),
      ]
    : [];

  const annotations_length = annotation_parts.reduce((sum, part) => sum + part.length, 0);
  const total_length = HEADER_SIZE + sequence.length + comment.length + annotations_length;
  const result = new Uint8Array(total_length);

  result[0] = xdna.header.version;
  result[1] = xdna.header.rawSequenceType;
  result[2] = xdna.header.rawTopology;
  writeUint32Be(result, 28, sequence.length);
  writeUint32Be(result, 32, xdna.header.negativeLength);
  writeUint32Be(result, 96, comment.length);
  result[111] = xdna.header.terminator;

  let offset = HEADER_SIZE;
  result.set(sequence, offset);
  offset += sequence.length;
  result.set(comment, offset);
  offset += comment.length;

  for (const part of annotation_parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}
