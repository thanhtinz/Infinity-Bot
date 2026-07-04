

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const DEFAULT_MESSAGE = 'Click the button below to verify yourself and gain access to the rest of the server.';

function buildVerificationPanel(config, guild) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${guild.name} Verification`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(config.message || DEFAULT_MESSAGE))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('verification_verify').setLabel('Verify').setStyle(ButtonStyle.Success)
        ));

    return container;
}

async function postVerificationPanel(config, guild) {
    const channel = guild.channels.cache.get(config.channelId);
    if (!channel) return null;

    const container = buildVerificationPanel(config, guild);

    if (config.panelMessageId) {
        try {
            const oldMsg = await channel.messages.fetch(config.panelMessageId);
            if (oldMsg) await oldMsg.delete();
        } catch { }
    }

    const panelMsg = await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    config.panelMessageId = panelMsg.id;
    await config.save();
    return panelMsg;
}

module.exports = { buildVerificationPanel, postVerificationPanel, DEFAULT_MESSAGE };
