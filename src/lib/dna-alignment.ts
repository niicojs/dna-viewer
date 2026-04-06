import { parseDnaText } from '#/lib/xdna-parser';

export type AlignmentConfig = {
  match_score: number;
  mismatch_penalty: number;
  gap_open_penalty: number;
  gap_extend_penalty: number;
};

export type CigarOp = { kind: 'M'; length: number } | { kind: 'I'; length: number } | { kind: 'D'; length: number };

export type AlignmentBlock = {
  query_start: number;
  reference_start: number;
  query_aligned: string;
  reference_aligned: string;
  marker_line: string;
};

export type AlignmentResult = {
  score: number;
  cigar: CigarOp[];
  cigar_text: string;
  mapped_position: number;
  mapping_quality: number;
  query_start: number;
  query_end: number;
  reference_start: number;
  reference_end: number;
  aligned_query: string;
  aligned_reference: string;
  marker_line: string;
  matches: number;
  mismatches: number;
  insertions: number;
  deletions: number;
  aligned_length: number;
  identity: number;
  blocks: AlignmentBlock[];
};

export type LoadedSequenceFile = {
  name: string;
  format: 'XDNA' | 'TXT' | 'FASTA';
  size: number;
  sequence: string;
  comment: string;
};

export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  match_score: 2,
  mismatch_penalty: -1,
  gap_open_penalty: -3,
  gap_extend_penalty: -1,
};

const NEGATIVE_INFINITY = Number.MIN_SAFE_INTEGER / 4;
const DNA_CHUNK_SIZE = 80;

export async function readAlignmentSequenceFile(file: File): Promise<LoadedSequenceFile> {
  const lower_name = file.name.toLowerCase();

  if (lower_name.endsWith('.xdna')) {
    const { readXdnaFile } = await import('#/lib/xdna-parser');
    const parsed = await readXdnaFile(file);

    return {
      name: parsed.file.name,
      format: parsed.file.format,
      size: parsed.file.size,
      sequence: parsed.sequence,
      comment: parsed.comment,
    };
  }

  if (
    lower_name.endsWith('.txt') ||
    lower_name.endsWith('.fa') ||
    lower_name.endsWith('.fasta') ||
    lower_name.endsWith('.fna')
  ) {
    const text = await file.text();
    const parsed = parseDnaText(text, file.name, file.size);

    return {
      name: parsed.file.name,
      format: parsed.file.format,
      size: parsed.file.size,
      sequence: parsed.sequence,
      comment: parsed.comment,
    };
  }

  throw new Error(`Unsupported file type: "${file.name}"`);
}

export function alignDnaSequences(
  query_sequence: string,
  reference_sequence: string,
  config: AlignmentConfig = DEFAULT_ALIGNMENT_CONFIG,
): AlignmentResult {
  if (!query_sequence || !reference_sequence) {
    throw new Error('Cannot align empty sequences');
  }

  const query_bases = query_sequence.toUpperCase().split('');
  const reference_bases = reference_sequence.toUpperCase().split('');
  const query_length = query_bases.length;
  const reference_length = reference_bases.length;
  const column_count = reference_length + 1;

  const h_prev = Array.from<number>({ length: column_count }).fill(0);
  const h_curr = Array.from<number>({ length: column_count }).fill(0);
  const e_prev = Array.from<number>({ length: column_count }).fill(NEGATIVE_INFINITY);
  const e_curr = Array.from<number>({ length: column_count }).fill(NEGATIVE_INFINITY);
  const traceback = new Uint8Array((query_length + 1) * column_count);

  let max_score = 0;
  let max_query_index = 0;
  let max_reference_index = 0;

  for (let query_index = 1; query_index <= query_length; query_index += 1) {
    const query_base = query_bases[query_index - 1];
    h_curr[0] = 0;
    e_curr[0] = NEGATIVE_INFINITY;
    let f_value = NEGATIVE_INFINITY;

    for (let reference_index = 1; reference_index <= reference_length; reference_index += 1) {
      const is_match = query_base === reference_bases[reference_index - 1];
      const match_mismatch_score = is_match ? config.match_score : config.mismatch_penalty;
      const e_value = Math.max(
        e_prev[reference_index] + config.gap_extend_penalty,
        h_prev[reference_index] + config.gap_open_penalty,
      );
      e_curr[reference_index] = e_value;

      f_value = Math.max(f_value + config.gap_extend_penalty, h_curr[reference_index - 1] + config.gap_open_penalty);

      const diagonal_score = h_prev[reference_index - 1] + match_mismatch_score;
      const best_score = Math.max(0, diagonal_score, e_value, f_value);
      h_curr[reference_index] = best_score;

      traceback[query_index * column_count + reference_index] =
        best_score === 0 ? 0 : best_score === diagonal_score ? 1 : best_score === e_value ? 2 : 3;

      if (best_score > max_score) {
        max_score = best_score;
        max_query_index = query_index;
        max_reference_index = reference_index;
      }
    }

    for (let index = 0; index < column_count; index += 1) {
      h_prev[index] = h_curr[index];
      e_prev[index] = e_curr[index];
    }
  }

  const raw_ops: Array<CigarOp & { query_base?: string; reference_base?: string }> = [];
  let query_index = max_query_index;
  let reference_index = max_reference_index;

  while (query_index > 0 && reference_index > 0) {
    const direction = traceback[query_index * column_count + reference_index];

    if (direction === 0) {
      break;
    }

    if (direction === 1) {
      raw_ops.push({
        kind: 'M',
        length: 1,
        query_base: query_bases[query_index - 1],
        reference_base: reference_bases[reference_index - 1],
      });
      query_index -= 1;
      reference_index -= 1;
      continue;
    }

    if (direction === 2) {
      raw_ops.push({ kind: 'I', length: 1, query_base: query_bases[query_index - 1] });
      query_index -= 1;
      continue;
    }

    raw_ops.push({ kind: 'D', length: 1, reference_base: reference_bases[reference_index - 1] });
    reference_index -= 1;
  }

  raw_ops.reverse();

  const cigar = mergeCigarOps(raw_ops);
  const query_start = query_index;
  const reference_start = reference_index;
  const query_end = max_query_index;
  const reference_end = max_reference_index;

  let aligned_query = '';
  let aligned_reference = '';
  let marker_line = '';
  let matches = 0;
  let mismatches = 0;
  let insertions = 0;
  let deletions = 0;

  for (const op of raw_ops) {
    if (op.kind === 'M') {
      const query_base = op.query_base ?? 'N';
      const reference_base = op.reference_base ?? 'N';
      const is_match = query_base === reference_base;

      aligned_query += query_base;
      aligned_reference += reference_base;
      marker_line += is_match ? '|' : '.';
      if (is_match) {
        matches += 1;
      } else {
        mismatches += 1;
      }
      continue;
    }

    if (op.kind === 'I') {
      aligned_query += op.query_base ?? 'N';
      aligned_reference += '-';
      marker_line += ' ';
      insertions += 1;
      continue;
    }

    aligned_query += '-';
    aligned_reference += op.reference_base ?? 'N';
    marker_line += ' ';
    deletions += 1;
  }

  const aligned_length = aligned_query.length;
  const identity = aligned_length === 0 ? 0 : matches / aligned_length;
  const mapping_quality = Math.min(60, Math.floor((Math.max(max_score, 0) / (Math.max(query_length, 1) * 2)) * 60));

  return {
    score: max_score,
    cigar,
    cigar_text: cigar.map((op) => `${op.length}${op.kind}`).join(''),
    mapped_position: reference_start,
    mapping_quality,
    query_start,
    query_end,
    reference_start,
    reference_end,
    aligned_query,
    aligned_reference,
    marker_line,
    matches,
    mismatches,
    insertions,
    deletions,
    aligned_length,
    identity,
    blocks: chunkAlignment(query_start, reference_start, aligned_query, aligned_reference, marker_line),
  };
}

function mergeCigarOps(ops: Array<CigarOp & { query_base?: string; reference_base?: string }>): CigarOp[] {
  if (ops.length === 0) {
    return [];
  }

  const merged: CigarOp[] = [];
  let current = { kind: ops[0].kind, length: ops[0].length } as CigarOp;

  for (let index = 1; index < ops.length; index += 1) {
    const op = ops[index];

    if (op.kind === current.kind) {
      current = { ...current, length: current.length + op.length } as CigarOp;
      continue;
    }

    merged.push(current);
    current = { kind: op.kind, length: op.length } as CigarOp;
  }

  merged.push(current);
  return merged;
}

function chunkAlignment(
  query_start: number,
  reference_start: number,
  aligned_query: string,
  aligned_reference: string,
  marker_line: string,
): AlignmentBlock[] {
  const blocks: AlignmentBlock[] = [];
  let query_offset = query_start;
  let reference_offset = reference_start;

  for (let index = 0; index < aligned_query.length; index += DNA_CHUNK_SIZE) {
    const query_aligned = aligned_query.slice(index, index + DNA_CHUNK_SIZE);
    const reference_aligned = aligned_reference.slice(index, index + DNA_CHUNK_SIZE);
    const marker_slice = marker_line.slice(index, index + DNA_CHUNK_SIZE);

    blocks.push({
      query_start: query_offset,
      reference_start: reference_offset,
      query_aligned,
      reference_aligned,
      marker_line: marker_slice,
    });

    query_offset += query_aligned.replace(/-/g, '').length;
    reference_offset += reference_aligned.replace(/-/g, '').length;
  }

  return blocks;
}
