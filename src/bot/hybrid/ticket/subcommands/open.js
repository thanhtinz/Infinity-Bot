
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { TicketConfig, Ticket } = require('../../../../database/models');
const { logTicketEvent, hasSupportRole } = require('../../../utils/ticketUtils');
const { tg } = require('../../../utils/i18n');

function reply(ctx, text) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    const opts = { components: [container], flags: MessageFlags.IsComponentsV2 };
    return ctx.deferred ? ctx.editReply(opts) : ctx.reply(opts);
}

function replyTitled(ctx, title, body) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    const opts = { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    return ctx.deferred ? ctx.editReply(opts) : ctx.reply(opts);
}

module.exports = {
    async execute(interactionOrMessage) {
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

        if (ticket.status !== 'closed') return reply(interactionOrMessage, await tg(guildId, 'ticket.open.alreadyStatus', { status: ticket.status }));

        const member = guild.members.cache.get(userId);
        if (!hasSupportRole(member, config)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.open.noPermission'));
        }

        try {
            const newStatus = ticket.claimedBy ? 'claimed' : 'open';
            ticket.status = newStatus;
            ticket.closedAt = null;
            await ticket.save();

            await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: true });

            const statusText = newStatus === 'claimed'
                ? await tg(guildId, 'ticket.open.claimedByStatus', { user: `<@${ticket.claimedBy}>` })
                : await tg(guildId, 'ticket.open.statusOpen');
            return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.open.reopenedTitle')}`, await tg(guildId, 'ticket.open.reopenedBody', { reopener: `<@${userId}>`, creator: `<@${ticket.userId}>`, status: statusText }));
        } catch (error) {
            console.error('Ticket reopen error:', error);
            return reply(interactionOrMessage, await tg(guildId, 'ticket.open.failed'));
        }
    }
};
