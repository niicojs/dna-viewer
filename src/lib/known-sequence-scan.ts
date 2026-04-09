import type { XdnaFile } from '#/lib/xdna-parser';

export type KnownSequenceCategory = 'promoter' | 'tag' | 'terminator' | 'restriction_site';
export type KnownSequenceKind = 'dna' | 'peptide';

export type KnownSequenceTarget = {
  name: string;
  category: KnownSequenceCategory;
  kind: KnownSequenceKind;
  description: string;
  sequence: string;
  feature_type: string;
  color: string;
};

export type KnownSequenceHit = {
  id: string;
  name: string;
  category: KnownSequenceCategory;
  kind: KnownSequenceKind;
  description: string;
  start: number;
  end: number;
  strand: 'forward' | 'reverse';
  frame: string | null;
  matched_sequence: string;
  reference_sequence: string;
  feature_type: string;
  color: string;
};

type DnaTarget = {
  name: string;
  category: KnownSequenceCategory;
  description: string;
  sequence: string;
  feature_type: string;
  color: string;
};

type PeptideTarget = {
  name: string;
  category: KnownSequenceCategory;
  description: string;
  peptide: string;
  feature_type: string;
  color: string;
};

const builtin_dna_targets: DnaTarget[] = [
  {
    name: 'SP6 promoter',
    category: 'promoter',
    description: 'Bacteriophage SP6 RNA polymerase promoter.',
    sequence: 'ATTTAGGTGACACTATAG',
    feature_type: 'Promoter',
    color: '233,122,54,',
  },
  {
    name: 'T7 promoter',
    category: 'promoter',
    description: 'Bacteriophage T7 RNA polymerase promoter.',
    sequence: 'TAATACGACTCACTATAGGG',
    feature_type: 'Promoter',
    color: '245,158,11,',
  },
  {
    name: 'CMV promoter',
    category: 'promoter',
    description: 'Core CMV immediate early promoter motif.',
    sequence: 'CGCAAATGGGCGGTAGGCGTG',
    feature_type: 'Promoter',
    color: '239,68,68,',
  },
  {
    name: 'BGH polyA',
    category: 'terminator',
    description: 'Bovine growth hormone polyadenylation signal region.',
    sequence: 'AATAAA',
    feature_type: 'misc_feature',
    color: '20,184,166,',
  },
  {
    name: 'EcoRI site',
    category: 'restriction_site',
    description: 'EcoRI restriction enzyme recognition site.',
    sequence: 'GAATTC',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'BamHI site',
    category: 'restriction_site',
    description: 'BamHI restriction enzyme recognition site.',
    sequence: 'GGATCC',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'HindIII site',
    category: 'restriction_site',
    description: 'HindIII restriction enzyme recognition site.',
    sequence: 'AAGCTT',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'XhoI site',
    category: 'restriction_site',
    description: 'XhoI restriction enzyme recognition site.',
    sequence: 'CTCGAG',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'NotI site',
    category: 'restriction_site',
    description: 'NotI restriction enzyme recognition site.',
    sequence: 'GCGGCCGC',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'NheI site',
    category: 'restriction_site',
    description: 'NheI restriction enzyme recognition site.',
    sequence: 'GCTAGC',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'XbaI site',
    category: 'restriction_site',
    description: 'XbaI restriction enzyme recognition site.',
    sequence: 'TCTAGA',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'KpnI site',
    category: 'restriction_site',
    description: 'KpnI restriction enzyme recognition site.',
    sequence: 'GGTACC',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
  {
    name: 'SpeI site',
    category: 'restriction_site',
    description: 'SpeI restriction enzyme recognition site.',
    sequence: 'ACTAGT',
    feature_type: 'misc_feature',
    color: '99,102,241,',
  },
];

const builtin_peptide_targets: PeptideTarget[] = [
  {
    name: '6xHis tag',
    category: 'tag',
    description: 'Polyhistidine purification tag.',
    peptide: 'HHHHHH',
    feature_type: 'misc_feature',
    color: '87,124,255,',
  },
  {
    name: 'E-tag',
    category: 'tag',
    description: 'E-tag epitope sequence used for detection.',
    peptide: 'GAPVPYPDPLEPR',
    feature_type: 'misc_feature',
    color: '139,92,246,',
  },
  {
    name: 'AviTag',
    category: 'tag',
    description: 'Biotin acceptor peptide tag.',
    peptide: 'GLNDIFEAQKIEWHE',
    feature_type: 'misc_feature',
    color: '16,185,129,',
  },
  {
    name: 'FLAG tag',
    category: 'tag',
    description: 'FLAG epitope tag for affinity purification and detection.',
    peptide: 'DYKDDDDK',
    feature_type: 'misc_feature',
    color: '236,72,153,',
  },
  {
    name: 'HA tag',
    category: 'tag',
    description: 'Influenza hemagglutinin epitope tag.',
    peptide: 'YPYDVPDYA',
    feature_type: 'misc_feature',
    color: '244,114,182,',
  },
  {
    name: 'Myc tag',
    category: 'tag',
    description: 'c-Myc epitope tag.',
    peptide: 'EQKLISEEDL',
    feature_type: 'misc_feature',
    color: '168,85,247,',
  },
  {
    name: 'T7 tag',
    category: 'tag',
    description: 'T7 epitope tag derived from T7 gene 10.',
    peptide: 'MASMTGGQQMG',
    feature_type: 'misc_feature',
    color: '59,130,246,',
  },
];

const codon_table: Record<string, string> = {
  TTT: 'F',
  TTC: 'F',
  TTA: 'L',
  TTG: 'L',
  TCT: 'S',
  TCC: 'S',
  TCA: 'S',
  TCG: 'S',
  TAT: 'Y',
  TAC: 'Y',
  TAA: '*',
  TAG: '*',
  TGT: 'C',
  TGC: 'C',
  TGA: '*',
  TGG: 'W',
  CTT: 'L',
  CTC: 'L',
  CTA: 'L',
  CTG: 'L',
  CCT: 'P',
  CCC: 'P',
  CCA: 'P',
  CCG: 'P',
  CAT: 'H',
  CAC: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGT: 'R',
  CGC: 'R',
  CGA: 'R',
  CGG: 'R',
  ATT: 'I',
  ATC: 'I',
  ATA: 'I',
  ATG: 'M',
  ACT: 'T',
  ACC: 'T',
  ACA: 'T',
  ACG: 'T',
  AAT: 'N',
  AAC: 'N',
  AAA: 'K',
  AAG: 'K',
  AGT: 'S',
  AGC: 'S',
  AGA: 'R',
  AGG: 'R',
  GTT: 'V',
  GTC: 'V',
  GTA: 'V',
  GTG: 'V',
  GCT: 'A',
  GCC: 'A',
  GCA: 'A',
  GCG: 'A',
  GAT: 'D',
  GAC: 'D',
  GAA: 'E',
  GAG: 'E',
  GGT: 'G',
  GGC: 'G',
  GGA: 'G',
  GGG: 'G',
};

function normalizeSequence(sequence: string) {
  return sequence
    .toUpperCase()
    .replace(/U/g, 'T')
    .replace(/[^ACGT]/g, 'N');
}

function reverseComplement(sequence: string) {
  const complement: Record<string, string> = {
    A: 'T',
    T: 'A',
    C: 'G',
    G: 'C',
    N: 'N',
  };

  return sequence
    .split('')
    .reverse()
    .map((base) => complement[base] ?? 'N')
    .join('');
}

function translateFrame(sequence: string, frame_offset: number) {
  let amino_acids = '';

  for (let index = frame_offset; index + 3 <= sequence.length; index += 3) {
    const codon = sequence.slice(index, index + 3);
    amino_acids += codon_table[codon] ?? 'X';
  }

  return amino_acids;
}

function pushDnaHits(sequence: string, target: DnaTarget, strand: 'forward' | 'reverse', hits: KnownSequenceHit[]) {
  let search_index = 0;

  while (search_index <= sequence.length - target.sequence.length) {
    const match_index = sequence.indexOf(target.sequence, search_index);
    if (match_index === -1) {
      break;
    }

    const start = strand === 'forward' ? match_index + 1 : sequence.length - (match_index + target.sequence.length) + 1;
    const end = strand === 'forward' ? match_index + target.sequence.length : sequence.length - match_index;

    hits.push({
      id: `${target.name}:${strand}:${start}:${end}:dna`,
      name: target.name,
      category: target.category,
      kind: 'dna',
      description: target.description,
      start,
      end,
      strand,
      frame: null,
      matched_sequence: target.sequence,
      reference_sequence: target.sequence,
      feature_type: target.feature_type,
      color: target.color,
    });

    search_index = match_index + 1;
  }
}

function pushPeptideHits(
  sequence: string,
  target: PeptideTarget,
  strand: 'forward' | 'reverse',
  hits: KnownSequenceHit[],
) {
  for (let frame_offset = 0; frame_offset < 3; frame_offset += 1) {
    const translated = translateFrame(sequence, frame_offset);
    let search_index = 0;

    while (search_index <= translated.length - target.peptide.length) {
      const match_index = translated.indexOf(target.peptide, search_index);
      if (match_index === -1) {
        break;
      }

      const nt_start_index = frame_offset + match_index * 3;
      const nt_end_index = nt_start_index + target.peptide.length * 3 - 1;
      const start = strand === 'forward' ? nt_start_index + 1 : sequence.length - nt_end_index;
      const end = strand === 'forward' ? nt_end_index + 1 : sequence.length - nt_start_index;

      hits.push({
        id: `${target.name}:${strand}:${frame_offset}:${start}:${end}:peptide`,
        name: target.name,
        category: target.category,
        kind: 'peptide',
        description: target.description,
        start,
        end,
        strand,
        frame: `${strand === 'forward' ? '+' : '-'}${frame_offset + 1}`,
        matched_sequence: sequence.slice(nt_start_index, nt_end_index + 1),
        reference_sequence: target.peptide,
        feature_type: target.feature_type,
        color: target.color,
      });

      search_index = match_index + 1;
    }
  }
}

export function getBuiltinKnownSequenceTargets(): KnownSequenceTarget[] {
  return [
    ...builtin_dna_targets.map((target) => ({
      name: target.name,
      category: target.category,
      kind: 'dna' as const,
      description: target.description,
      sequence: target.sequence,
      feature_type: target.feature_type,
      color: target.color,
    })),
    ...builtin_peptide_targets.map((target) => ({
      name: target.name,
      category: target.category,
      kind: 'peptide' as const,
      description: target.description,
      sequence: target.peptide,
      feature_type: target.feature_type,
      color: target.color,
    })),
  ];
}

export function getKnownSequenceHits(xdna: XdnaFile, custom_targets: KnownSequenceTarget[] = []) {
  const sequence = normalizeSequence(xdna.sequence);
  const reverse_sequence = reverseComplement(sequence);
  const hits: KnownSequenceHit[] = [];
  const targets = custom_targets;

  for (const target of targets) {
    if (target.kind === 'dna') {
      const dna_target: DnaTarget = {
        name: target.name,
        category: target.category,
        description: target.description,
        sequence: normalizeSequence(target.sequence),
        feature_type: target.feature_type,
        color: target.color,
      };

      if (!dna_target.sequence.length) continue;

      pushDnaHits(sequence, dna_target, 'forward', hits);
      pushDnaHits(reverse_sequence, dna_target, 'reverse', hits);
      continue;
    }

    const peptide_target: PeptideTarget = {
      name: target.name,
      category: target.category,
      description: target.description,
      peptide: target.sequence.trim().toUpperCase(),
      feature_type: target.feature_type,
      color: target.color,
    };

    if (!peptide_target.peptide.length) continue;

    pushPeptideHits(sequence, peptide_target, 'forward', hits);
    pushPeptideHits(reverse_sequence, peptide_target, 'reverse', hits);
  }

  return hits.sort(
    (left, right) => left.start - right.start || left.end - right.end || left.name.localeCompare(right.name),
  );
}
