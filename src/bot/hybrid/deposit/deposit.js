
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, getOrCreateBalance, formatAmount, resolveUserId } = require('../../utils/economyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Move coins from your wallet into your (robbery-safe) bank')
        .addStringOption(o => o.setName('amount').setDescription('Amount, or "all"').setRequired(true)),

    name: 'deposit',
    aliases: ['dep'],
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        const userId = resolveUserId(interactionOrMessage);
        const balance = await getOrCreateBalance(guildId, userId, config);

        const raw = (isSlash ? interactionOrMessage.options.getString('amount') : args[0] || '').trim().toLowerCase();
        let amount;
        if (raw === 'all') {
            amount = balance.wallet;
        } else {
            amount = Math.floor(Number(raw));
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.common.invalidAmount'), true);
        }
        if (amount > balance.wallet) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.common.insufficientFunds'), true);
        }

        balance.wallet -= amount;
        balance.bank += amount;
        await balance.save();

        return reply(interactionOrMessage, await tg(guildId, 'economy.deposit.title'), await tg(guildId, 'economy.deposit.success', {
            amount: formatAmount(config, amount),
            wallet: formatAmount(config, balance.wallet),
            bank: formatAmount(config, balance.bank)
        }));
    }
};
