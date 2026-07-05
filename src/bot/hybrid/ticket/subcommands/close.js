
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const { TicketConfig, Ticket } = require('../../../../database/models');
const { logTicketEvent, generateAndSendTranscript, hasSupportRole } = require('../../../utils/ticketUtils');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    const opts = { components: [container], flags: MessageFlags.IsComponentsV2 };
    return ctx.deferred ? ctx.editReply(opts) : ctx.reply(opts);
}

module.exports = {
    async execute(interactionOrMessage, args) {
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const channel = interactionOrMessage.channel;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;

        const [ticket, config] = await Promise.all([
            Ticket.findOne({ where: { channelId: channel.id } }),
            TicketConfig.findOne({ where: { guildId: guild.id } })
        ]);
        if (!ticket) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.invalidTicketChannel'));
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfiguredPlain'));

        if (ticket.status === 'closed') return reply(interactionOrMessage, await tg(guildId, 'ticket.close.alreadyClosed'));

        const member = guild.members.cache.get(userId);
        if (ticket.userId !== userId && !hasSupportRole(member, config)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.close.noPermission'));
        }

        try {
            const isSlash = interactionOrMessage.isCommand?.();
            const noReason = await tg(guildId, 'common.noReasonProvided');
            const reason = isSlash
                ? (interactionOrMessage.options.getString('reason') || noReason)
                : (args.join(' ') || noReason);

            ticket.status = 'closed';
            ticket.closedAt = new Date();
            await ticket.save();

            await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false });

            generateAndSendTranscript(guild, config, ticket, interactionOrMessage.client).catch(() => {});

            const closedContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.close.closedTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Reopen').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
                ));

            const sendOpts = { components: [closedContainer], flags: MessageFlags.IsComponentsV2 };
            if (interactionOrMessage.deferred) await interactionOrMessage.editReply(sendOpts);
            else await interactionOrMessage.reply(sendOpts);

            logTicketEvent(guild, config, 'Ticket Closed', `**Ticket:** ${channel}\n**Closed by:** <@${userId}>\n**Reason:** ${reason}`).catch(() => {});
        } catch (error) {
            console.error('Ticket close error:', error);
            return reply(interactionOrMessage, await tg(guildId, 'ticket.close.failed'));
        }
    }
};
