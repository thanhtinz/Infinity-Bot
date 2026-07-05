
const { Op } = require('sequelize');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { EconomyConfig, EconomyGameSettings, EconomyMarriage } = require('../../../database/models');
const { tg } = require('../../utils/i18n');

function simpleReply(interaction, text, ephemeral = true) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

async function findMarriage(guildId, userId) {
    return EconomyMarriage.findOne({ where: { guildId, [Op.or]: [{ user1Id: userId }, { user2Id: userId }] } });
}

/** Handles the Accept/Decline buttons posted by `/marry` (src/bot/hybrid/marry/marry.js). */
async function handle(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;
    if (!customId.startsWith('economy_marry_accept_') && !customId.startsWith('economy_marry_decline_')) return false;

    const isAccept = customId.startsWith('economy_marry_accept_');
    const rest = customId.replace(isAccept ? 'economy_marry_accept_' : 'economy_marry_decline_', '');
    const [proposerId, targetId] = rest.split('_');
    const guildId = interaction.guild?.id;

    if (interaction.user.id !== targetId) {
        await simpleReply(interaction, await tg(guildId, 'economy.marry.notForYou'));
        return true;
    }

    if (!isAccept) {
        await interaction.update({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'economy.marry.declined', { target: `<@${targetId}>` })))],
            flags: MessageFlags.IsComponentsV2
        });
        return true;
    }

    try {
        const config = await EconomyConfig.findOne({ where: { guildId } });
        if (!config || !config.enabled) {
            await simpleReply(interaction, await tg(guildId, 'economy.common.notUnlockedBody'));
            return true;
        }
        const gameSettings = await EconomyGameSettings.findOne({ where: { guildId, game: 'marry' } });
        if (gameSettings && !gameSettings.enabled) {
            await simpleReply(interaction, await tg(guildId, 'economy.common.gameDisabledBody', { game: 'marry' }));
            return true;
        }

        const [proposerMarriage, targetMarriage] = await Promise.all([
            findMarriage(guildId, proposerId),
            findMarriage(guildId, targetId)
        ]);
        if (proposerMarriage || targetMarriage) {
            await interaction.update({
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'economy.marry.oneOfYouAlreadyMarried')))],
                flags: MessageFlags.IsComponentsV2
            });
            return true;
        }

        await EconomyMarriage.create({ guildId, user1Id: proposerId, user2Id: targetId, marriedAt: new Date() });

        await interaction.update({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'economy.marry.accepted', { proposer: `<@${proposerId}>`, target: `<@${targetId}>` })))],
            flags: MessageFlags.IsComponentsV2
        });
        return true;
    } catch (error) {
        console.error('Economy marry handler error:', error);
        try {
            await simpleReply(interaction, await tg(guildId, 'common.genericError'));
        } catch { /* interaction may already be acknowledged */ }
        return true;
    }
}

module.exports = { handle };
