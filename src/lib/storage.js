// ============================================================================
// LOCAL STORAGE HYGIENE
// Everything this app keeps lives in localStorage. This module is the single
// place that knows the keys, validates what is loaded, drops legacy/experimental
// keys from older builds, and can wipe the workspace on demand.
// ============================================================================

export const STORAGE_PREFIX = 'deal_analyzer';

export const HISTORY_KEY = 'deal_analyzer_v2_history';
export const VOICE_PROFILE_KEY = 'deal_analyzer_voice_profile';
export const GUIDE_PROGRESS_KEY = 'deal_analyzer_guide_progress_v1';
export const GUIDE_SEEN_KEY = 'deal_analyzer_guide_seen_v1';
export const API_KEY_STORAGE = 'deal_analyzer_gemini_key';
export const MODEL_STORAGE = 'deal_analyzer_gemini_model';
export const THEME_STORAGE = 'deal_analyzer_theme';
export const SCHEMA_KEY = 'deal_analyzer_schema_version';

export const SCHEMA_VERSION = '3';
export const MAX_SAVED_DEALS = 50;
export const MAX_CONVERSATION_CHARS = 20000;

export const KNOWN_KEYS = [
  HISTORY_KEY,
  VOICE_PROFILE_KEY,
  GUIDE_PROGRESS_KEY,
  GUIDE_SEEN_KEY,
  API_KEY_STORAGE,
  MODEL_STORAGE,
  THEME_STORAGE,
  SCHEMA_KEY
];

// Keys shipped by older builds / abandoned experiments. Removed on boot.
export const LEGACY_KEYS = [
  'deal_analyzer_v1_history',
  'deal_analyzer_history',
  'deal_analyzer_saved_deals',
  'deal_analyzer_last_deal',
  'deal_analyzer_voiceprint',
  'deal_analyzer_api_key',
  'deal_analyzer_model',
  'deal_analyzer_dark',
  'deal_analyzer_guide_seen',
  'deal_analyzer_guide_progress',
  'deal_analyzer_preset_deal'
];

function getStore(scope) {
  const target = scope || (typeof window !== 'undefined' ? window : null);
  try {
    return target?.localStorage || null;
  } catch {
    return null;
  }
}

export function safeGet(key, fallback = null, scope) {
  const store = getStore(scope);
  if (!store) return fallback;
  try {
    const value = store.getItem(key);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function safeSet(key, value, scope) {
  const store = getStore(scope);
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key, scope) {
  const store = getStore(scope);
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function listStorageKeys(store) {
  const keys = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key) keys.push(key);
    }
  } catch {
    // ignore
  }
  if (keys.length === 0) {
    try {
      keys.push(...Object.keys(store));
    } catch {
      // ignore
    }
  }
  return keys;
}

function looksLikeDeal(deal) {
  return Boolean(
    deal &&
      typeof deal === 'object' &&
      typeof deal.address === 'string' &&
      deal.address.trim().length > 2
  );
}

/**
 * Keep only usable deals: an address is mandatory, ids are unique, the list is
 * capped and each conversation is trimmed to a sane size.
 */
export function sanitizeSavedDeals(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const cleaned = [];

  input.forEach((deal, index) => {
    if (!looksLikeDeal(deal)) return;
    const id = String(deal.id || `saved-${Date.now()}-${index}`);
    if (seen.has(id)) return;
    seen.add(id);
    cleaned.push({
      ...deal,
      id,
      address: deal.address.trim(),
      date: deal.date || new Date().toISOString().slice(0, 16).replace('T', ' '),
      conversation:
        typeof deal.conversation === 'string'
          ? deal.conversation.slice(0, MAX_CONVERSATION_CHARS)
          : ''
    });
  });

  return cleaned.slice(0, MAX_SAVED_DEALS);
}

export function loadSavedDeals(scope) {
  const raw = safeGet(HISTORY_KEY, null, scope);
  if (!raw) return [];
  try {
    return sanitizeSavedDeals(JSON.parse(raw));
  } catch {
    safeRemove(HISTORY_KEY, scope);
    return [];
  }
}

export function saveSavedDeals(deals, scope) {
  return safeSet(HISTORY_KEY, JSON.stringify(sanitizeSavedDeals(deals)), scope);
}

/**
 * Boot-time migration: drop keys from old builds, repair a corrupt history
 * blob, and reset the "guide already seen" flag when the schema changes so the
 * user actually sees the updated guide instead of a stale dismissed state.
 */
export function migrateStorage(scope) {
  LEGACY_KEYS.forEach((key) => safeRemove(key, scope));

  const storedVersion = safeGet(SCHEMA_KEY, null, scope);
  const isFirstRunAfterUpdate = storedVersion !== SCHEMA_VERSION;

  const rawHistory = safeGet(HISTORY_KEY, null, scope);
  if (rawHistory) {
    try {
      const parsed = JSON.parse(rawHistory);
      const cleaned = sanitizeSavedDeals(parsed);
      if (cleaned.length !== (Array.isArray(parsed) ? parsed.length : 0)) {
        saveSavedDeals(cleaned, scope);
      }
    } catch {
      safeRemove(HISTORY_KEY, scope);
    }
  }

  if (isFirstRunAfterUpdate) {
    safeRemove(GUIDE_SEEN_KEY, scope);
    safeSet(SCHEMA_KEY, SCHEMA_VERSION, scope);
  }

  return { migrated: isFirstRunAfterUpdate, storedVersion };
}

/**
 * Wipe the workspace: saved deals, guide progress, voice profile and any other
 * key this app owns. API key / model / theme are kept unless told otherwise.
 */
export function wipeDealData({ keepApiKey = true, keepTheme = true, scope } = {}) {
  const store = getStore(scope);
  if (!store) return { removed: [] };

  const keep = new Set([SCHEMA_KEY]);
  if (keepApiKey) {
    keep.add(API_KEY_STORAGE);
    keep.add(MODEL_STORAGE);
  }
  if (keepTheme) keep.add(THEME_STORAGE);

  const keys = listStorageKeys(store);
  const removed = [];
  keys
    .filter((key) => String(key).startsWith(STORAGE_PREFIX))
    .filter((key) => !keep.has(key))
    .forEach((key) => {
      if (safeRemove(key, scope)) removed.push(key);
    });

  safeSet(SCHEMA_KEY, SCHEMA_VERSION, scope);
  return { removed };
}

export function storageFacts(scope) {
  const store = getStore(scope);
  if (!store) return { keyCount: 0, savedDeals: 0, hasApiKey: false };
  const keys = listStorageKeys(store).filter((key) => String(key).startsWith(STORAGE_PREFIX));
  return {
    keyCount: keys.length,
    savedDeals: loadSavedDeals(scope).length,
    hasApiKey: Boolean(safeGet(API_KEY_STORAGE, '', scope))
  };
}
