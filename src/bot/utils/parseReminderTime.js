const ms = require('ms');
const ai = require('./ai');

/**
 * Resolves a user-supplied "when" string into an absolute Date.
 * First tries `ms`-style relative durations ("30m", "2h", "1d"). If that fails
 * and the user has an AI key configured, asks the AI to convert free-form
 * natural language ("tomorrow at 9am") into an ISO timestamp.
 *
 * Returns { date: Date|null, error?: 'no_ai_key'|'ai_error'|'ai_unparseable' }
 */
async function parseWhen(userId, when) {
    const relative = ms(String(when).trim());
    if (typeof relative === 'number' && relative > 0) {
        return { date: new Date(Date.now() + relative) };
    }

    try {
        const nowIso = new Date().toISOString();
        const { text } = await ai.chat(
            userId,
            [
                {
                    role: 'user',
                    content: `The current UTC time is ${nowIso}. Convert the following phrase into a single absolute ISO 8601 UTC timestamp representing when it refers to. Respond with ONLY the ISO timestamp and nothing else: "${when}"`,
                },
            ],
            { systemPrompt: 'You convert natural language time phrases into precise ISO 8601 UTC timestamps. Respond with only the timestamp, no other text.' }
        );

        const match = text && text.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/);
        if (match) {
            const date = new Date(match[0].replace(' ', 'T'));
            if (!Number.isNaN(date.getTime()) && date.getTime() > Date.now()) {
                return { date };
            }
        }
        return { date: null, error: 'ai_unparseable' };
    } catch (error) {
        if (error instanceof ai.NoActiveKeyError) {
            return { date: null, error: 'no_ai_key' };
        }
        return { date: null, error: 'ai_error' };
    }
}

module.exports = { parseWhen };
