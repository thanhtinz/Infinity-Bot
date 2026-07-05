
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
        if (!ticket) return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.invalidTicket'));
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfiguredPlain'));

        const member = guild.members.cache.get(userId);
        if (!hasSupportRole(member, config)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.noPermission'));
        }

        if (ticket.userId === userId) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.ownTicket'));
        }

        if (ticket.status === 'deleted') return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.deleted'));
        if (ticket.status === 'closed') return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.closed'));

        if (ticket.claimedBy) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.claim.alreadyClaimed', { user: `<@${ticket.claimedBy}>` }));
        }

        ticket.claimedBy = userId;
        ticket.status = 'claimed';
        await ticket.save();

        logTicketEvent(guild, config, 'Ticket Claimed', `**Ticket:** ${channel}\n**Claimed by:** <@${userId}>`).catch(() => {});

        return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.claim.claimedTitle')}`, await tg(guildId, 'ticket.claim.claimedBody', { user: `<@${userId}>` }));
    }
};
