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
 * Shared by both the static-catalog lookup (`t`) and the DB-override lookup (`tg`) so the two
 * paths always substitute placeholders identically.
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
 *
 * Unlike `t()`, this also consults `MessageOverride` (owner-admin-editable custom templates) for
 * the resolved (key, language) pair before falling back to the static JSON catalogs - this is the
 * ONLY lookup path that does so. `t()` stays static-file-only and synchronous on purpose: many
 * call sites use it directly without a guildId/DB context available, and must keep working exactly
 * as before.
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

    try {
        const MessageOverride = require('../../database/models/MessageOverride');
        const override = await MessageOverride.getTemplate(key, lang);
        if (typeof override === 'string' && override.length > 0) {
            return interpolate(override, vars);
        }
    } catch {
        // DB unavailable or lookup failed - fall through to the static catalog, same as always.
    }

    return t(lang, key, vars);
}

module.exports = { t, tg, DEFAULT_LANGUAGE };
