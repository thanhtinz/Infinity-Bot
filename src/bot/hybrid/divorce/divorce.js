
const { SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { tg } = require('../../utils/i18n');
const { reply, requireEconomy, requireGameEnabled, resolveUserId } = require('../../utils/economyUtils');
const { EconomyMarriage } = require('../../../database/models');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('End your current Infinity Economy marriage'),

    name: 'divorce',
    category: 'economy',

    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;
        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'marry');
        if (!settings) return;

        const userId = resolveUserId(interactionOrMessage);
        const marriage = await EconomyMarriage.findOne({ where: { guildId, [Op.or]: [{ user1Id: userId }, { user2Id: userId }] } });
        if (!marriage) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.divorce.notMarried'), true);
        }

        const partnerId = marriage.user1Id === userId ? marriage.user2Id : marriage.user1Id;
        await marriage.destroy();

        return reply(interactionOrMessage, await tg(guildId, 'economy.divorce.title'), await tg(guildId, 'economy.divorce.success', { partner: `<@${partnerId}>` }));
    }
};
