'use strict';

const express = require('express');
const { MessageOverride } = require('../../../src/database/models');
const { getCatalog, getCatalogEntry } = require('../../../src/bot/utils/i18nCatalog');

const router = express.Router();

const SUPPORTED_LANGUAGES = ['en', 'vi'];

async function loadOverridesMap() {
    const rows = await MessageOverride.findAll();
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.key)) map.set(row.key, {});
        map.get(row.key)[row.language] = row.template;
    }
    return map;
}

function serializeEntry(entry, overridesForKey) {
    const overrides = overridesForKey || {};
    return {
        key: entry.key,
        category: entry.category,
        defaultEn: entry.defaultEn,
        defaultVi: entry.defaultVi,
        placeholders: entry.placeholders,
        overrideEn: overrides.en ?? null,
        overrideVi: overrides.vi ?? null,
        customized: Boolean(overrides.en || overrides.vi)
    };
}

// GET /api/messages - full catalog merged with any saved overrides, so the frontend can show
// "currently customized" vs "using default" per key/language.
router.get('/', async (req, res) => {
    try {
        const catalog = getCatalog();
        const overridesMap = await loadOverridesMap();

        const entries = catalog.map((entry) => serializeEntry(entry, overridesMap.get(entry.key)));
        res.json({ entries, total: entries.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to load message catalog' });
    }
});

// GET /api/messages/:key - one key's detail (default EN/VI + any overrides + placeholder list).
router.get('/:key', async (req, res) => {
    try {
        const entry = getCatalogEntry(req.params.key);
        if (!entry) return res.status(404).json({ error: 'unknown message key' });

        const rows = await MessageOverride.findAll({ where: { key: req.params.key } });
        const overrides = {};
        for (const row of rows) overrides[row.language] = row.template;

        res.json(serializeEntry(entry, overrides));
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to load message' });
    }
});

// PUT /api/messages/:key - body { language: 'en'|'vi', template: string } - upserts an override
// and invalidates the cache immediately so it takes effect on the live bot without a restart.
router.put('/:key', async (req, res) => {
    try {
        const entry = getCatalogEntry(req.params.key);
        if (!entry) return res.status(404).json({ error: 'unknown message key' });

        const { language, template } = req.body || {};
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({ error: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` });
        }
        if (typeof template !== 'string' || template.trim().length === 0) {
            return res.status(400).json({ error: 'template must be a non-empty string' });
        }

        await MessageOverride.setTemplate(req.params.key, language, template);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to save override' });
    }
});

// DELETE /api/messages/:key - body/query { language } - removes the override, reverting to the
// static catalog default. Also cache-invalidated immediately.
router.delete('/:key', async (req, res) => {
    try {
        const entry = getCatalogEntry(req.params.key);
        if (!entry) return res.status(404).json({ error: 'unknown message key' });

        const language = (req.body && req.body.language) || req.query.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            return res.status(400).json({ error: `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` });
        }

        await MessageOverride.clearTemplate(req.params.key, language);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message || 'failed to reset override' });
    }
});

module.exports = router;
