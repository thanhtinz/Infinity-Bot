
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
    async execute(interactionOrMessage, args) {
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;
        const channel = interactionOrMessage.channel;
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
        const isSlash = interactionOrMessage.isCommand?.();

        let targetUserId;
        if (isSlash) {
            const u = interactionOrMessage.options.getUser('user');
            targetUserId = u?.id;
        } else {
            if (!args[0]) return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.usage'));
            targetUserId = args[0].replace(/[<@!>]/g, '');
        }

        const [ticket, config] = await Promise.all([
            Ticket.findOne({ where: { channelId: channel.id } }),
            TicketConfig.findOne({ where: { guildId: guild.id } })
        ]);

        if (!ticket) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.invalidTicketChannel'));
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfiguredPlain'));

        const member = guild.members.cache.get(userId);
        if (!hasSupportRole(member, config)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.noPermission'));
        }

        if (!ticket.claimedBy) return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.notClaimed'));
        if (ticket.claimedBy !== userId && !member.permissions.has('Administrator')) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.notClaimantOrAdmin'));
        }

        if (targetUserId === ticket.claimedBy) return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.sameUser'));

        try {
            const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
            if (!targetMember) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.userNotFoundInServer'));

            if (!hasSupportRole(targetMember, config)) {
                return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.targetNotStaff'));
            }

            const previousClaimer = ticket.claimedBy;
            ticket.claimedBy = targetUserId;
            await ticket.save();

            logTicketEvent(guild, config, 'Ticket Transferred', `**Ticket:** ${channel}\n**From:** <@${previousClaimer}>\n**To:** <@${targetUserId}>\n**Transferred by:** <@${userId}>`).catch(() => {});

            return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.transfer.transferredTitle')}`, await tg(guildId, 'ticket.transfer.transferredBody', { from: `<@${previousClaimer}>`, to: `<@${targetUserId}>` }));
        } catch (error) {
            console.error('Ticket transfer error:', error);
            return reply(interactionOrMessage, await tg(guildId, 'ticket.transfer.failed'));
        }
    }
};
