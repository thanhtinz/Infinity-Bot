
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, requireGameEnabled, getOrCreateBalance, validateBet, formatAmount, resolveUserId, isSlashCtx } = require('../../utils/economyUtils');

// Rarer symbols pay more; weights control how often each symbol is drawn.
const SYMBOLS = [
    { emoji: '🍒', weight: 40, triple: 2 },
    { emoji: '🍋', weight: 30, triple: 3 },
    { emoji: '🔔', weight: 18, triple: 5 },
    { emoji: '⭐', weight: 9, triple: 10 },
    { emoji: '💎', weight: 3, triple: 25 }
];
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

function spinReel() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const symbol of SYMBOLS) {
        if (roll < symbol.weight) return symbol;
        roll -= symbol.weight;
    }
    return SYMBOLS[0];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Spin the Infinity Economy slot machine')
        .addIntegerOption(o => o.setName('bet').setDescription('How much to bet').setRequired(true).setMinValue(1)),

    name: 'slot',
    aliases: ['slots'],
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;
        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'slot');
        if (!settings) return;

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);

        const rawBet = isSlash ? interactionOrMessage.options.getInteger('bet') : args[0];
        const check = await validateBet(guildId, settings, balance.wallet, rawBet);
        if (!check.ok) return reply(interactionOrMessage, await tg(guildId, 'common.error'), check.message, true);
        const bet = check.amount;

        const reels = [spinReel(), spinReel(), spinReel()];
        const reelText = reels.map((s) => s.emoji).join(' | ');

        let payout = 0;
        let resultKey;
        if (reels[0].emoji === reels[1].emoji && reels[1].emoji === reels[2].emoji) {
            payout = bet * reels[0].triple;
            resultKey = 'economy.slot.jackpot';
        } else if (reels[0].emoji === reels[1].emoji || reels[1].emoji === reels[2].emoji || reels[0].emoji === reels[2].emoji) {
            payout = Math.round(bet * 1.5);
            resultKey = 'economy.slot.partialMatch';
        } else {
            payout = 0;
            resultKey = 'economy.slot.noMatch';
        }

        balance.wallet += payout - bet;
        await balance.save();

        const body = await tg(guildId, resultKey, {
            reels: reelText,
            bet: formatAmount(config, bet),
            payout: formatAmount(config, payout)
        });
        return reply(interactionOrMessage, await tg(guildId, 'economy.slot.title'), body);
    }
};
