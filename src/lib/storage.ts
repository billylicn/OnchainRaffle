import { DEFAULT_DRAFT, type ConfirmedDraw, type DrawConfiguration, type DrawDraft, type DrawResult, type LockedDraw } from '../types/draw';
import { normalizeGridRows } from './participants';

const DRAFT_KEY = 'chain-draw:draft:v1';
const CONFIG_KEY = 'chain-draw:configuration:v1';
const LOCK_KEY = 'chain-draw:locked:v1';
const CONFIRMED_KEY = 'chain-draw:confirmed:v1';
const RESULT_KEY = 'chain-draw:result:v1';
const RPC_KEY = 'chain-draw:rpc:v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

export function loadDraft(): DrawDraft {
  try {
    const value = localStorage.getItem(DRAFT_KEY);
    if (!value) return DEFAULT_DRAFT;
    const stored = JSON.parse(value) as Partial<DrawDraft> & { pastedText?: string; firstRowHeader?: boolean };
    const { pastedText: _legacyText, firstRowHeader: legacyHeader, ...draft } = stored;
    if (Array.isArray(stored.participantRows)) return { ...DEFAULT_DRAFT, ...draft, rangeStart: '1', participantRows: normalizeGridRows(stored.participantRows.map((row) => [row.id, row.name])) } as DrawDraft;
    const pastedRows = (stored.pastedText ?? '').split(/\r?\n/u).map((line) => line.includes('\t') ? line.split('\t') : line.split(/[,，]/u));
    const migratedRows = legacyHeader ? pastedRows.slice(1) : pastedRows;
    return { ...DEFAULT_DRAFT, ...draft, rangeStart: '1', participantRows: normalizeGridRows(migratedRows) } as DrawDraft;
  } catch {
    return DEFAULT_DRAFT;
  }
}

export function saveDraft(draft: DrawDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function saveConfiguration(configuration: DrawConfiguration): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configuration));
}

export function loadConfiguration(): DrawConfiguration | null {
  try {
    const value = localStorage.getItem(CONFIG_KEY);
    return value ? JSON.parse(value) as DrawConfiguration : null;
  } catch {
    return null;
  }
}

export function saveLockedDraw(draw: LockedDraw): void { localStorage.setItem(LOCK_KEY, JSON.stringify(draw)); }
export function loadLockedDraw(): LockedDraw | null { return loadExact<LockedDraw>(LOCK_KEY); }
export function saveConfirmedDraw(draw: ConfirmedDraw): void { localStorage.setItem(CONFIRMED_KEY, JSON.stringify(draw)); }
export function loadConfirmedDraw(): ConfirmedDraw | null { return loadExact<ConfirmedDraw>(CONFIRMED_KEY); }
export function saveDrawResult(draw: DrawResult): void { localStorage.setItem(RESULT_KEY, JSON.stringify(draw)); }
export function loadDrawResult(): DrawResult | null { return loadExact<DrawResult>(RESULT_KEY); }
export function saveCustomRpc(url: string): void { localStorage.setItem(RPC_KEY, url); }
export function loadCustomRpc(): string { return localStorage.getItem(RPC_KEY) ?? ''; }

export function clearDrawSession(): void {
  [LOCK_KEY, CONFIRMED_KEY, RESULT_KEY].forEach((key) => localStorage.removeItem(key));
}

export function startNewDraw(): void {
  [CONFIG_KEY, LOCK_KEY, CONFIRMED_KEY, RESULT_KEY].forEach((key) => localStorage.removeItem(key));
}

export function hasUnfinishedDraw(): boolean {
  return Boolean(localStorage.getItem(LOCK_KEY) || localStorage.getItem(CONFIRMED_KEY)) && !localStorage.getItem(RESULT_KEY);
}

function loadExact<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}
