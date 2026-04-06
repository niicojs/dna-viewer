const HEADER_SIZE = 112;

function fail(message: string): never {
  throw new Error(message);
}

function assertReadableRange(buffer: Buffer, offset: number, length: number, label: string) {
  if (offset < 0 || length < 0 || offset + length > buffer.length) {
    fail(`Cannot read ${label} at offset ${offset} (length ${length}, file size ${buffer.length})`);
  }
}

function readUInt32BE(buffer: Buffer, offset: number, label: string) {
  assertReadableRange(buffer, offset, 4, label);
  return buffer.readUInt32BE(offset);
}

function readPascalString(buffer: Buffer, offset: number, label: string) {
  assertReadableRange(buffer, offset, 1, `${label} length`);
  const length = buffer.readUInt8(offset);
  const start = offset + 1;
  assertReadableRange(buffer, start, length, label);

  return {
    value: buffer.toString('latin1', start, start + length),
    nextOffset: start + length,
    length,
  };
}

function parseIntegerString(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    fail(`Invalid numeric string for ${label}: ${JSON.stringify(value)}`);
  }

  return Number.parseInt(trimmed, 10);
}

function parseOverhang(buffer: Buffer, offset: number, side: 'left' | 'right') {
  const lengthField = readPascalString(buffer, offset, `${side} overhang length`);
  const declaredLength = parseIntegerString(lengthField.value || '0', `${side} overhang length`);
  const sequenceLength = Math.abs(declaredLength);

  if (sequenceLength === 0) {
    return {
      overhang: {
        side,
        type: 'none',
        declaredLength,
        sequence: '',
      },
      nextOffset: lengthField.nextOffset,
    };
  }

  assertReadableRange(buffer, lengthField.nextOffset, sequenceLength, `${side} overhang sequence`);
  const sequence = buffer.toString('latin1', lengthField.nextOffset, lengthField.nextOffset + sequenceLength);

  return {
    overhang: {
      side,
      type: declaredLength > 0 ? "5'" : "3'",
      declaredLength,
      sequence,
    },
    nextOffset: lengthField.nextOffset + sequenceLength,
  };
}

function parseFeature(buffer: Buffer, offset: number, index: number) {
  const nameField = readPascalString(buffer, offset, `feature ${index} name`);
  const descriptionField = readPascalString(buffer, nameField.nextOffset, `feature ${index} description`);
  const typeField = readPascalString(buffer, descriptionField.nextOffset, `feature ${index} type`);
  const startField = readPascalString(buffer, typeField.nextOffset, `feature ${index} start`);
  const endField = readPascalString(buffer, startField.nextOffset, `feature ${index} end`);

  assertReadableRange(buffer, endField.nextOffset, 4, `feature ${index} flags`);
  const flagsOffset = endField.nextOffset;
  const strandFlag = buffer.readUInt8(flagsOffset);
  const displayFlag = buffer.readUInt8(flagsOffset + 1);
  const unknownFlag = buffer.readUInt8(flagsOffset + 2);
  const arrowFlag = buffer.readUInt8(flagsOffset + 3);

  const colorField = readPascalString(buffer, flagsOffset + 4, `feature ${index} color`);
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

function parseTopology(value: number) {
  if (value === 0) return 'linear';
  if (value === 1) return 'circular';
  return `unknown(${value})`;
}

function parseSequenceType(value: number) {
  if (value === 1) return 'DNA';
  if (value === 2) return 'degenerated DNA';
  if (value === 3) return 'RNA';
  if (value === 4) return 'protein';
  return `unknown(${value})`;
}

export function parseXdna(buffer: Buffer) {
  if (buffer.length < HEADER_SIZE) fail(`File is too short for an XDNA header (${buffer.length} bytes)`);

  const sequenceLength = readUInt32BE(buffer, 28, 'sequence length');
  const negativeLength = readUInt32BE(buffer, 32, 'negative length');
  const commentLength = readUInt32BE(buffer, 96, 'comment length');

  const sequenceOffset = HEADER_SIZE;
  const commentOffset = sequenceOffset + sequenceLength;

  assertReadableRange(buffer, sequenceOffset, sequenceLength, 'sequence');
  assertReadableRange(buffer, commentOffset, commentLength, 'comment');

  const sequence = buffer.toString('latin1', sequenceOffset, commentOffset);
  const comment = buffer.toString('latin1', commentOffset, commentOffset + commentLength);

  let offset = commentOffset + commentLength;
  let annotations = null;

  if (offset < buffer.length) {
    assertReadableRange(buffer, offset, 1, 'annotation marker');
    const marker = buffer.readUInt8(offset);
    offset += 1;

    const rightOverhang = parseOverhang(buffer, offset, 'right');
    offset = rightOverhang.nextOffset;

    const leftOverhang = parseOverhang(buffer, offset, 'left');
    offset = leftOverhang.nextOffset;

    assertReadableRange(buffer, offset, 1, 'feature count');
    const featureCount = buffer.readUInt8(offset);
    offset += 1;

    const features = [];
    for (let index = 0; index < featureCount; index += 1) {
      const parsedFeature = parseFeature(buffer, offset, index + 1);
      features.push(parsedFeature.feature);
      offset = parsedFeature.nextOffset;
    }

    annotations = {
      marker,
      rightOverhang: rightOverhang.overhang,
      leftOverhang: leftOverhang.overhang,
      featureCount,
      features,
      trailingBytes: buffer.length - offset,
    };
  }

  return {
    file: {
      size: buffer.length,
      format: 'XDNA',
    },
    header: {
      version: buffer.readUInt8(0),
      sequenceType: parseSequenceType(buffer.readUInt8(1)),
      rawSequenceType: buffer.readUInt8(1),
      topology: parseTopology(buffer.readUInt8(2)),
      rawTopology: buffer.readUInt8(2),
      sequenceLength,
      negativeLength,
      commentLength,
      terminator: buffer.readUInt8(111),
    },
    offsets: {
      header: { start: 0, end: HEADER_SIZE },
      sequence: { start: sequenceOffset, end: commentOffset },
      comment: { start: commentOffset, end: commentOffset + commentLength },
      annotations: annotations ? { start: commentOffset + commentLength, end: buffer.length } : null,
    },
    sequence,
    comment,
    annotations,
  };
}
