
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, getOrCreateBalance, formatAmount, resolveUserId } = require('../../utils/economyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Move coins from your bank back into your (robbable) wallet')
        .addStringOption(o => o.setName('amount').setDescription('Amount, or "all"').setRequired(true)),

    name: 'withdraw',
    aliases: ['with'],
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
            amount = balance.bank;
        } else {
            amount = Math.floor(Number(raw));
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.common.invalidAmount'), true);
        }
        if (amount > balance.bank) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.withdraw.insufficientBank'), true);
        }

        balance.bank -= amount;
        balance.wallet += amount;
        await balance.save();

        return reply(interactionOrMessage, await tg(guildId, 'economy.withdraw.title'), await tg(guildId, 'economy.withdraw.success', {
            amount: formatAmount(config, amount),
            wallet: formatAmount(config, balance.wallet),
            bank: formatAmount(config, balance.bank)
        }));
    }
};
