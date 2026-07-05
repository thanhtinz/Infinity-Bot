
const {
    PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const { TicketConfig, TicketCategory } = require('../../../../database/models');
const { logTicketEvent } = require('../../../utils/ticketUtils');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    const opts = { components: [container], flags: MessageFlags.IsComponentsV2 };
    return ctx.deferred ? ctx.editReply(opts) : ctx.reply(opts);
}

module.exports = {
    async execute(interactionOrMessage) {
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
        const member = guild.members.cache.get(userId);

        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.adminRequired'));
        }

        const config = await TicketConfig.findOne({ where: { guildId: guild.id } });
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.reset.notConfigured'));

        const confirmContainer = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.reset.confirmTitle')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.reset.confirmBody')))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_reset_confirm').setLabel('Reset').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_reset_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            ));

        const isSlash = interactionOrMessage.isCommand?.();
        let msg;
        if (isSlash) {
            msg = await interactionOrMessage.reply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2, fetchReply: true });
        } else {
            msg = await interactionOrMessage.reply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
        }

        if (!msg) msg = await interactionOrMessage.fetchReply?.();

        const filter = i => i.user.id === userId && i.message.id === msg.id;
        const collector = msg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async interaction => {
            if (interaction.customId === 'ticket_reset_cancel') {
                const cancelContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.reset.cancelledTitle')}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.reset.cancelledBody')));
                await interaction.update({ components: [cancelContainer] });
                collector.stop();
                return;
            }

            if (interaction.customId === 'ticket_reset_confirm') {
                try {
                    const user = interactionOrMessage.user || interactionOrMessage.author;
                    await logTicketEvent(guild, config, 'Ticket System Reset', `**Reset by:** <@${userId}>`);

                    await TicketCategory.destroy({ where: { guildId: guild.id } });
                    await TicketConfig.destroy({ where: { guildId: guild.id } });

                    const doneContainer = new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.reset.doneTitle')}`))
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.reset.doneBody')));
                    await interaction.update({ components: [doneContainer] });
                } catch (error) {
                    console.error('Ticket reset error:', error);
                    const errContainer = new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.reset.failed')));
                    await interaction.update({ components: [errContainer] });
                }
                collector.stop();
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                const timeoutContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.reset.timeoutTitle')}`))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.reset.timeoutBody')));
                msg.edit({ components: [timeoutContainer] }).catch(() => {});
            }
        });
    }
};
