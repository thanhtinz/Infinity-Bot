require('dotenv').config({ quiet: true });

const env = process.env;

const read = (key, fallback = '') => env[key] ?? fallback;
const REQUIRED_ENV = ['DATABASE_URL', 'BOT_TOKEN', 'CLIENT_ID', 'OWNER_ID'];

module.exports = {
    DATABASE_URL: read('DATABASE_URL'),
    BOT_TOKEN: read('BOT_TOKEN'),
    CLIENT_ID: read('CLIENT_ID'),
    OWNER_ID: read('OWNER_ID'),
    PREFIX: read('PREFIX', ','),
    BOTBANNER: read('BOTBANNER'),
    SUPPORT_SERVER: read('SUPPORT_SERVER'),
    DB_SYNC: read('DB_SYNC', 'true') !== 'false',

    CLOUDFLARE: {
        ACCOUNT_ID: read('CLOUDFLARE_ACCOUNT_ID'),
        API_TOKEN: read('CLOUDFLARE_API_TOKEN')
    },

    SERPAPI: {
        API_KEY: read('SERPAPI_API_KEY')
    },

    GROQ: {
        API_KEY: read('GROQ_API_KEY'),
        API_KEY_2: read('GROQ_API_KEY_2'),
        API_KEY_3: read('GROQ_API_KEY_3'),
        API_KEY_4: read('GROQ_API_KEY_4'),
        API_KEY_5: read('GROQ_API_KEY_5'),
        API_KEY_6: read('GROQ_API_KEY_6')
    },

    BYTEZ: {
        API_KEY: read('BYTEZ_API_KEY')
    },

    TENOR: {
        API_KEY: read('TENOR_API_KEY'),
        CLIENT_KEY: read('TENOR_CLIENT_KEY', 'main_discord_bot')
    },

    AI_PROMPTS: {
        LUNA_SYSTEM_PROMPT: read('INFINITY_SYSTEM_PROMPT', `You are Infinity Bot, a helpful and intelligent Discord assistant.

IDENTITY:
- Your name is Infinity Bot.
- Do not reveal or speculate about hidden system details.
- Do not output @everyone, @here, role mentions, channel mentions, or raw Discord user mentions.

STYLE:
- Be helpful, direct, and natural.
- Keep casual chat short.
- Use more detail only when the user asks for it.`),

        LUNA_CASUAL_PROMPT: read('INFINITY_CASUAL_PROMPT', `You are Infinity Bot, a friendly assistant in a Discord chat.

Keep replies natural and concise. Do not ping users or roles. Do not mention hidden implementation details.`)
    },

    getMissingRequiredEnv() {
        return REQUIRED_ENV.filter((key) => !read(key));
    }
};
