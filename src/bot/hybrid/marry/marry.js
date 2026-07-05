
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { tg } = require('../../utils/i18n');
const { reply, buildContainer, requireEconomy, requireGameEnabled, resolveUserId, isSlashCtx } = require('../../utils/economyUtils');
const { EconomyMarriage } = require('../../../database/models');
const { Op } = require('sequelize');

async function findMarriage(guildId, userId) {
    return EconomyMarriage.findOne({ where: { guildId, [Op.or]: [{ user1Id: userId }, { user2Id: userId }] } });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Propose marriage to another member')
        .addUserOption(o => o.setName('user').setDescription('Who to propose to').setRequired(true)),

    name: 'marry',
    category: 'economy',

    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        if (!guild) return reply(interactionOrMessage, null, await tg(null, 'economy.common.guildOnly'), true);
        const guildId = guild.id;
        const isSlash = isSlashCtx(interactionOrMessage);

        const config = await requireEconomy(interactionOrMessage, guildId);
        if (!config) return;
        const settings = await requireGameEnabled(interactionOrMessage, guildId, 'marry');
        if (!settings) return;

        const proposerId = resolveUserId(interactionOrMessage);
        const targetUser = isSlash ? interactionOrMessage.options.getUser('user') : interactionOrMessage.mentions?.users?.first();
        if (!targetUser) return reply(interactionOrMessage, await tg(guildId, 'common.userNotFound'), await tg(guildId, 'economy.marry.noTarget'), true);

        if (targetUser.id === proposerId) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.marry.cannotMarrySelf'), true);
        }
        if (targetUser.bot) {
            return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.marry.cannotMarryBot'), true);
        }

        const [proposerMarriage, targetMarriage] = await Promise.all([
            findMarriage(guildId, proposerId),
            findMarriage(guildId, targetUser.id)
        ]);
        if (proposerMarriage) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.marry.alreadyMarriedSelf'), true);
        if (targetMarriage) return reply(interactionOrMessage, await tg(guildId, 'common.error'), await tg(guildId, 'economy.marry.alreadyMarriedTarget', { user: targetUser.username || targetUser.tag }), true);

        const body = await tg(guildId, 'economy.marry.proposalBody', { proposer: `<@${proposerId}>`, target: `<@${targetUser.id}>` });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`economy_marry_accept_${proposerId}_${targetUser.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`economy_marry_decline_${proposerId}_${targetUser.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
        );

        return interactionOrMessage.reply({
            components: [buildContainer(await tg(guildId, 'economy.marry.title'), body), row],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
