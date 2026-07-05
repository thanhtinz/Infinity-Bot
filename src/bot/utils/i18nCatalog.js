/**
 * Read-only introspection over the static i18n catalogs (`src/bot/i18n/en.json` / `vi.json`).
 * Used by the Owner Admin Panel's "Messages" page to list every translatable key without ever
 * hardcoding or duplicating the key list - it's always derived live from the JSON files, so any
 * key another change adds to those catalogs shows up automatically.
 *
 * NOTE: this module only *reads* en.json/vi.json - it never writes to them. Customizations are
 * stored separately in the `MessageOverride` DB table (see `src/database/models/MessageOverride.js`
 * and `tg()` in `src/bot/utils/i18n.js`).
 */

const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, '..', 'i18n', 'en.json');
const VI_PATH = path.join(__dirname, '..', 'i18n', 'vi.json');

// Re-read at most once per minute so an admin-panel page load never hammers disk, while still
// picking up new keys added by other work (e.g. the giveaway redesign) without a bot restart.
const REFRESH_INTERVAL = 60000;

let cachedCatalog = null;
let cachedAt = 0;

function loadJson(filePath) {
    try {
        delete require.cache[require.resolve(filePath)];
        return require(filePath);
    } catch {
        return {};
    }
}

/**
 * Flatten a nested object into dot-separated leaf paths, e.g.
 * { moderation: { ban: { success: '...' } } } -> [['moderation.ban.success', '...']]
 */
function flatten(obj, prefix = '') {
    const out = [];
    if (!obj || typeof obj !== 'object') return out;

    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            out.push(...flatten(v, fullKey));
        } else if (typeof v === 'string') {
            out.push([fullKey, v]);
        }
    }
    return out;
}

/**
 * Extract the set of {placeholder} names referenced in a template string, in order of first
 * appearance, without duplicates.
 */
function extractPlaceholders(template) {
    if (typeof template !== 'string') return [];
    const seen = new Set();
    const result = [];
    const re = /\{(\w+)\}/g;
    let match;
    while ((match = re.exec(template)) !== null) {
        if (!seen.has(match[1])) {
            seen.add(match[1]);
            result.push(match[1]);
        }
    }
    return result;
}

function buildCatalog() {
    const en = loadJson(EN_PATH);
    const vi = loadJson(VI_PATH);

    const enFlat = new Map(flatten(en));
    const viFlat = new Map(flatten(vi));

    const allKeys = new Set([...enFlat.keys(), ...viFlat.keys()]);

    const entries = [];
    for (const key of allKeys) {
        const defaultEn = enFlat.get(key) ?? null;
        const defaultVi = viFlat.get(key) ?? null;
        const category = key.split('.')[0];
        const placeholders = extractPlaceholders(defaultEn || defaultVi || '');

        entries.push({ key, category, defaultEn, defaultVi, placeholders });
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));
    return entries;
}

/**
 * Returns the flattened key catalog: [{ key, category, defaultEn, defaultVi, placeholders }, ...]
 * Cached for up to REFRESH_INTERVAL ms; pass forceRefresh=true to bypass the cache.
 */
function getCatalog(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedCatalog && now - cachedAt < REFRESH_INTERVAL) {
        return cachedCatalog;
    }

    cachedCatalog = buildCatalog();
    cachedAt = now;
    return cachedCatalog;
}

function getCatalogEntry(key) {
    return getCatalog().find((entry) => entry.key === key) || null;
}

module.exports = { getCatalog, getCatalogEntry, extractPlaceholders };
