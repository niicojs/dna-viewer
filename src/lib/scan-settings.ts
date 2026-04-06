import { getBuiltinKnownSequenceTargets, type KnownSequenceCategory, type KnownSequenceTarget } from '#/lib/known-sequence-scan';

export type ScanSettings = {
  version: 1;
  known_sequences: KnownSequenceTarget[];
};

export type ScanSettingsSequenceDraft = {
  name: string;
  category: KnownSequenceCategory;
  kind: 'dna' | 'peptide';
  description: string;
  sequence: string;
  feature_type: string;
  color: string;
};

export const SCAN_SETTINGS_STORAGE_KEY = 'scan-settings';
export const SCAN_SETTINGS_FILE_NAME = 'nico-dna-settings.json';

export function getDefaultScanSettings(): ScanSettings {
  return {
    version: 1,
    known_sequences: getBuiltinKnownSequenceTargets(),
  };
}

function isKnownSequenceCategory(value: string): value is KnownSequenceCategory {
  return value === 'promoter' || value === 'tag' || value === 'terminator' || value === 'restriction_site';
}

function normalizeColor(color: string) {
  const cleaned = color.trim();
  return cleaned.endsWith(',') ? cleaned : `${cleaned},`;
}

function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function colorToHex(color: string) {
  const channels = color
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((value) => Number.parseInt(value, 10));

  if (channels.length !== 3 || channels.some((value) => Number.isNaN(value))) {
    return '#577cff';
  }

  return `#${channels.map((value) => clampColorChannel(value).toString(16).padStart(2, '0')).join('')}`;
}

export function hexToColor(hex: string) {
  const normalized = hex.trim().replace(/^#/, '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '87,124,255,';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red},${green},${blue},`;
}

function normalizeFeatureType(feature_type: string, category: KnownSequenceCategory) {
  const cleaned = feature_type.trim();

  if (cleaned) {
    return cleaned;
  }

  return category === 'promoter' ? 'Promoter' : 'misc_feature';
}

function normalizeSequenceDraft(entry: unknown): KnownSequenceTarget | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const candidate = entry as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const category = typeof candidate.category === 'string' ? candidate.category : '';
  const kind = candidate.kind === 'dna' || candidate.kind === 'peptide' ? candidate.kind : null;
  const description = typeof candidate.description === 'string' ? candidate.description.trim() : '';
  const sequence = typeof candidate.sequence === 'string' ? candidate.sequence.trim().toUpperCase() : '';
  const feature_type = typeof candidate.feature_type === 'string' ? candidate.feature_type : '';
  const color = typeof candidate.color === 'string' ? candidate.color : '';

  if (!name || !isKnownSequenceCategory(category) || !kind || !description || !sequence || !color.trim()) {
    return null;
  }

  return {
    name,
    category,
    kind,
    description,
    sequence,
    feature_type: normalizeFeatureType(feature_type, category),
    color: normalizeColor(color),
  };
}

export function sanitizeScanSettings(settings: unknown): ScanSettings {
  if (!settings || typeof settings !== 'object') {
    return getDefaultScanSettings();
  }

  const candidate = settings as Record<string, unknown>;
  const known_sequences_input = Array.isArray(candidate.known_sequences) ? candidate.known_sequences : [];
  const known_sequences = known_sequences_input
    .map((entry) => normalizeSequenceDraft(entry))
    .filter((entry): entry is KnownSequenceTarget => entry !== null);

  return {
    version: 1,
    known_sequences,
  };
}

export function loadScanSettings() {
  if (typeof window === 'undefined') {
    return getDefaultScanSettings();
  }

  try {
    const raw = window.localStorage.getItem(SCAN_SETTINGS_STORAGE_KEY);
    return raw ? sanitizeScanSettings(JSON.parse(raw)) : getDefaultScanSettings();
  } catch {
    return getDefaultScanSettings();
  }
}

export function saveScanSettings(settings: ScanSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SCAN_SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeScanSettings(settings), null, 2));
}

export function createSequenceFromDraft(draft: ScanSettingsSequenceDraft): KnownSequenceTarget {
  return {
    name: draft.name.trim(),
    category: draft.category,
    kind: draft.kind,
    description: draft.description.trim(),
    sequence: draft.sequence.trim().toUpperCase(),
    feature_type: normalizeFeatureType(draft.feature_type, draft.category),
    color: normalizeColor(draft.color),
  };
}
