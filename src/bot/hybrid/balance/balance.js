
const { SlashCommandBuilder } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, getOrCreateBalance, formatAmount } = require('../../utils/economyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your (or someone else\'s) Infinity Economy wallet and bank balance')
        .addUserOption(o => o.setName('user').setDescription('Whose balance to check (defaults to you)')),

    name: 'balance',
    aliases: ['bal'],
    category: 'economy',

    async execute(interactionOrMessage, args = []) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = interactionOrMessage.isChatInputCommand?.();

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;

        let target = isSlash ? (interactionOrMessage.options.getUser('user') || interactionOrMessage.user) : (interactionOrMessage.mentions?.users?.first() || interactionOrMessage.author);
        if (!target) target = isSlash ? interactionOrMessage.user : interactionOrMessage.author;

        const balance = await getOrCreateBalance(guildId, target.id, config);
        const title = target.id === (isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id)
            ? await tg(guildId, 'economy.balance.titleSelf')
            : await tg(guildId, 'economy.balance.titleOther', { user: target.username || target.tag || target.id });

        const body = await tg(guildId, 'economy.balance.body', {
            wallet: formatAmount(config, balance.wallet),
            bank: formatAmount(config, balance.bank),
            total: formatAmount(config, balance.wallet + balance.bank)
        });

        return reply(interactionOrMessage, title, body);
    }
};
