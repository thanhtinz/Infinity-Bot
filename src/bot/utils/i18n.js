/**
 * Lightweight i18n helper for bilingual (English / Vietnamese) bot replies.
 *
 * Usage:
 *   const { t, tg } = require('../utils/i18n');
 *   t('vi', 'moderation.ban.success', { user: 'foo', reason: 'bar' });
 *   await tg(guildId, 'moderation.ban.success', { user: 'foo', reason: 'bar' });
 *
 * Translation files live in `src/bot/i18n/en.json` and `src/bot/i18n/vi.json`
 * as nested objects. Keys are dot-separated paths, e.g. "moderation.ban.success".
 *
 * Lookup never throws and never returns an empty string for a "known" key:
 *   1. Try the requested language.
 *   2. Fall back to English.
 *   3. Fall back to the raw key itself (so a typo is visible/debuggable instead
 *      of silently producing a blank message).
 */

const en = require('../i18n/en.json');
const vi = require('../i18n/vi.json');

const DEFAULT_LANGUAGE = 'en';
const CATALOGS = { en, vi };

/**
 * Resolve a dot-separated path (e.g. "moderation.ban.success") inside a
 * nested object. Returns undefined if any segment is missing.
 */
function resolvePath(obj, key) {
    if (!obj) return undefined;
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate {placeholders} in a template string with values from `vars`.
 * Missing variables are left as-is (e.g. "{user}") rather than throwing.
 */
function interpolate(template, vars) {
    if (!vars || typeof template !== 'string') return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
}

/**
 * Synchronous translation lookup.
 * @param {string} lang - 'en' | 'vi' (anything else falls back to 'en')
 * @param {string} key - dot-separated translation key
 * @param {object} [vars] - placeholder values for interpolation
 * @returns {string}
 */
function t(lang, key, vars) {
    const catalog = CATALOGS[lang] || CATALOGS[DEFAULT_LANGUAGE];

    let str = resolvePath(catalog, key);
    if (str === undefined && lang !== DEFAULT_LANGUAGE) {
        str = resolvePath(CATALOGS[DEFAULT_LANGUAGE], key);
    }
    if (str === undefined) {
        str = key;
    }

    return interpolate(str, vars);
}

/**
 * Async convenience wrapper: resolves the guild's configured language, then
 * translates. Falls back to English if no guildId is available or lookup fails.
 * @param {string} guildId
 * @param {string} key
 * @param {object} [vars]
 */
async function tg(guildId, key, vars) {
    let lang = DEFAULT_LANGUAGE;
    try {
        if (guildId) {
            const GuildLanguage = require('../../database/models/GuildLanguage');
            lang = await GuildLanguage.getLanguage(guildId);
        }
    } catch {
        lang = DEFAULT_LANGUAGE;
    }
    return t(lang, key, vars);
}

module.exports = { t, tg, DEFAULT_LANGUAGE };
