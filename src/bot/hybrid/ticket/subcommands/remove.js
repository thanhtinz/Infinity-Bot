
const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
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
            if (!args[0]) return reply(interactionOrMessage, await tg(guildId, 'ticket.remove.usage'));
            targetUserId = args[0].replace(/[<@!>]/g, '');
        }

        const [ticket, config] = await Promise.all([
            Ticket.findOne({ where: { channelId: channel.id } }),
            TicketConfig.findOne({ where: { guildId: guild.id } })
        ]);

        if (!ticket) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.invalidTicketChannel'));
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfiguredPlain'));

        const member = guild.members.cache.get(userId);
        const canManage = ticket.userId === userId || ticket.claimedBy === userId || hasSupportRole(member, config);
        if (!canManage) return reply(interactionOrMessage, await tg(guildId, 'ticket.remove.noPermission'));

        if (targetUserId === ticket.userId) return reply(interactionOrMessage, await tg(guildId, 'ticket.remove.cannotRemoveCreator'));

        try {
            const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
            if (!targetMember) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.userNotFoundInServer'));

            const existingPerms = channel.permissionsFor(targetMember);
            if (!existingPerms?.has(PermissionsBitField.Flags.ViewChannel)) {
                return reply(interactionOrMessage, await tg(guildId, 'ticket.remove.noAccess', { user: targetMember.user.tag }));
            }

            await channel.permissionOverwrites.delete(targetMember.id);

            logTicketEvent(guild, config, 'User Removed from Ticket', `**Ticket:** ${channel}\n**Removed User:** <@${targetMember.id}>\n**Removed by:** <@${userId}>`).catch(() => {});

            return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.remove.removedTitle')}`, await tg(guildId, 'ticket.remove.removedBody', { user: `<@${targetMember.id}>` }));
        } catch (error) {
            console.error('Ticket remove user error:', error);
            return reply(interactionOrMessage, await tg(guildId, 'ticket.remove.failed'));
        }
    }
};
