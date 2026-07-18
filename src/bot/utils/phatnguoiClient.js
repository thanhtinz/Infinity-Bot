'use strict';

/**
 * Adapter for looking up Vietnamese traffic camera violations ("phạt nguội") by license plate.
 *
 * Research summary (see PHATNGUOI_SETUP.md in the repo root for the full writeup):
 *  - The official source (csgt.vn, Cục Cảnh sát giao thông) requires solving an interactive
 *    CAPTCHA to submit a lookup. We do not automate CAPTCHA solving against a government site.
 *  - The official mobile app "VNeTraffic" (Bộ Công an / GTEL) has no public third-party API.
 *  - Third-party consumer sites (phatnguoi.vn, phatnguoi.app, checkphatnguoi.vn, ...) are
 *    human-facing web forms with no documented, integration-intended public API.
 *  - Every community "API" we found is a scraper that works around csgt.vn's CAPTCHA, which
 *    is exactly the kind of anti-bot circumvention this project avoids building.
 *
 * Because of that, this module does NOT ship a scraper. Instead it defines a small, honest
 * adapter contract: if the bot owner stands up (or gains legitimate access to) a lookup
 * service of their own — for example self-hosting one of the open-source lookup tools under
 * their own responsibility, or a future official/documented API — they can point this bot at
 * it via PHATNGUOI_API_BASE_URL (+ optional PHATNGUOI_API_KEY) and it will "just work" against
 * the simple JSON contract described below. Until those env vars are set, lookups fail closed
 * with a clear "not configured" error rather than returning or fabricating fake data.
 *
 * Expected contract when PHATNGUOI_API_BASE_URL is configured:
 *   GET {PHATNGUOI_API_BASE_URL}/lookup?plate=<normalized plate>&type=<oto|xemay|xedap-dien>
 *   Headers: Authorization: Bearer <PHATNGUOI_API_KEY>   (only sent if the key is set)
 *   Response JSON: { violations: [ { date, location, description, status, ... }, ... ] }
 */

const axios = require('axios');

class PhatNguoiNotConfiguredError extends Error {
    constructor() {
        super('No phạt nguội lookup service is configured (PHATNGUOI_API_BASE_URL is not set)');
        this.code = 'PHATNGUOI_NOT_CONFIGURED';
    }
}

class PhatNguoiServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.code = 'PHATNGUOI_SERVICE_ERROR';
        this.status = status;
    }
}

/**
 * Normalize and loosely validate a Vietnamese license plate.
 * Accepts input with or without dashes/dots/spaces, e.g. "30A-123.45", "30A12345", "59-f1 234.56".
 * Returns the normalized plate string (e.g. "30A-12345") or null if it doesn't look like a plate.
 */
function normalizePlate(raw) {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.toUpperCase().replace(/[\s.\-_]/g, '');
    // Province code (2 digits) + series (1-2 letters, sometimes a trailing digit for motorbikes) + 4-5 digit number.
    // The number length is fixed (not a range starting from the series) so the regex engine
    // backtracks the optional series digit correctly instead of misparsing e.g. "30A12345".
    const match = cleaned.match(/^(\d{2})([A-Z]{1,2}\d??)(\d{4,5})$/);
    if (!match) return null;
    const [, province, series, number] = match;
    return `${province}${series}-${number}`;
}

function isConfigured() {
    return Boolean(process.env.PHATNGUOI_API_BASE_URL);
}

/**
 * Look up violations for a normalized plate. Throws PhatNguoiNotConfiguredError if no
 * lookup service is wired up, or PhatNguoiServiceError on a downstream failure.
 */
async function lookupViolations({ plate, vehicleType }) {
    const baseUrl = process.env.PHATNGUOI_API_BASE_URL;
    if (!baseUrl) throw new PhatNguoiNotConfiguredError();

    const apiKey = process.env.PHATNGUOI_API_KEY;

    try {
        const response = await axios.get(`${baseUrl.replace(/\/+$/, '')}/lookup`, {
            params: { plate, type: vehicleType },
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
            timeout: 15000,
        });

        const data = response.data || {};
        const violations = Array.isArray(data.violations) ? data.violations : [];
        return { violations };
    } catch (error) {
        if (error.response) {
            throw new PhatNguoiServiceError(
                `Lookup service responded with an error (HTTP ${error.response.status})`,
                error.response.status
            );
        }
        if (error.code === 'ECONNABORTED') {
            throw new PhatNguoiServiceError('Lookup service timed out');
        }
        throw new PhatNguoiServiceError('Could not reach the lookup service');
    }
}

module.exports = {
    normalizePlate,
    isConfigured,
    lookupViolations,
    PhatNguoiNotConfiguredError,
    PhatNguoiServiceError,
};
