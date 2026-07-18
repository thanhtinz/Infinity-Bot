const { ChatChannel } = require('../../database/models');
const ai = require('../utils/ai');

const HISTORY_LIMIT = 10;
const history = new Map(); // channelId -> [{role, content}]
const enabledChannelCache = new Map(); // channelId -> { val: boolean, ts }
const CACHE_TTL = 30000;

async function isAiChannel(channelId) {
    const cached = enabledChannelCache.get(channelId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;
    const row = await ChatChannel.findOne({ where: { channelId } });
    const val = !!row;
    enabledChannelCache.set(channelId, { val, ts: Date.now() });
    return val;
}

function pushHistory(channelId, entry) {
    const list = history.get(channelId) || [];
    list.push(entry);
    while (list.length > HISTORY_LIMIT) list.shift();
    history.set(channelId, list);
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        if (!message.content?.trim()) return;

        const isDM = !message.guild;
        if (!isDM && !(await isAiChannel(message.channelId))) return;

        await message.channel.sendTyping().catch(() => {});
        pushHistory(message.channelId, { role: 'user', content: message.content });

        try {
            const { text } = await ai.chat(message.author.id, history.get(message.channelId), {
                systemPrompt: 'You are Infinity, a helpful, friendly, concise Discord AI assistant. Keep replies conversational.',
            });

            pushHistory(message.channelId, { role: 'assistant', content: text });

            const chunks = text.match(/[\s\S]{1,1900}/g) || ['(empty response)'];
            for (const chunk of chunks) await message.reply(chunk);
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return message.reply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('[messageCreate] AI chat error:', error);
            await message.reply('Something went wrong talking to the AI provider. Check your key with `/aiconfig status`.').catch(() => {});
        }
    },
};
