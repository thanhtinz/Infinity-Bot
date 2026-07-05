
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, requireGameEnabled, getOrCreateBalance, validateBet, formatAmount, resolveUserId, isSlashCtx } = require('../../utils/economyUtils');

// Named `/coinbet` (not `/coinflip`) - `/coinflip` is already taken by the non-betting fun-extra
// randomizer command (src/bot/commands/fun-extra/generated/coinflip.js). This is the Infinity
// Economy's betting version; its underlying EconomyGameSettings.game value is still 'coinflip' to
// match the spec'd game list.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinbet')
        .setDescription('Bet coins on a coin flip')
        .addIntegerOption(o => o.setName('bet').setDescription('How much to bet').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('side').setDescription('Heads or tails').setRequired(true)
            .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),

    name: 'coinbet',
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;
        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'coinflip');
        if (!settings) return;

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);

        const rawBet = isSlash ? interactionOrMessage.options.getInteger('bet') : args[0];
        const side = (isSlash ? interactionOrMessage.options.getString('side') : args[1] || '').toLowerCase();
        if (!['heads', 'tails'].includes(side)) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.coinbet.invalidSide'), true);
        }

        const check = await validateBet(guildId, settings, balance.wallet, rawBet);
        if (!check.ok) return reply(interactionOrMessage, await tg(guildId, 'common.error'), check.message, true);
        const bet = check.amount;

        const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = outcome === side;
        const payout = won ? bet * 2 : 0;

        balance.wallet += payout - bet;
        await balance.save();

        const body = await tg(guildId, won ? 'economy.coinbet.win' : 'economy.coinbet.lose', {
            outcome,
            bet: formatAmount(config, bet),
            payout: formatAmount(config, payout)
        });
        return reply(interactionOrMessage, await tg(guildId, 'economy.coinbet.title'), body);
    }
};
