


const Giveaway = require('../../database/models/Giveaway');
const GiveawayEntry = require('../../database/models/GiveawayEntry');
const { emojiMatches } = require('../utils/starboardUtils');

const giveawayCache = new Map();
const CACHE_TTL = 15000;

async function getActiveGiveaway(messageId) {
    const cached = giveawayCache.get(messageId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.val;

    const val = await Giveaway.findOne({ where: { messageId, ended: false } });
    giveawayCache.set(messageId, { val, ts: Date.now() });
    return val;
}

async function handleReactionAdd(reaction, user) {
    try {
        if (user.bot) return;
        if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
        if (!reaction) return;

        let message = reaction.message;
        if (message.partial) message = await message.fetch().catch(() => null);
        if (!message || !message.guild) return;

        const giveaway = await getActiveGiveaway(message.id);
        if (!giveaway) return;
        if (!emojiMatches(giveaway.emoji, reaction.emoji)) return;

        await GiveawayEntry.findOrCreate({
            where: { giveawayId: giveaway.id, userId: user.id },
            defaults: { giveawayId: giveaway.id, userId: user.id }
        });
    } catch (error) {
        console.error('Giveaway reaction add error:', error);
    }
}

async function handleReactionRemove(reaction, user) {
    try {
        if (user.bot) return;
        if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
        if (!reaction) return;

        let message = reaction.message;
        if (message.partial) message = await message.fetch().catch(() => null);
        if (!message || !message.guild) return;

        const giveaway = await getActiveGiveaway(message.id);
        if (!giveaway) return;
        if (!emojiMatches(giveaway.emoji, reaction.emoji)) return;

        await GiveawayEntry.destroy({
            where: { giveawayId: giveaway.id, userId: user.id }
        });
    } catch (error) {
        console.error('Giveaway reaction remove error:', error);
    }
}

module.exports = {
    name: 'giveawayReactionEvent',

    init(client) {
        client.on('messageReactionAdd', (reaction, user) => handleReactionAdd(reaction, user));
        client.on('messageReactionRemove', (reaction, user) => handleReactionRemove(reaction, user));
    }
};
