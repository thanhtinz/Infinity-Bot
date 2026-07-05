
const {
    PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags
} = require('discord.js');
const { TicketConfig } = require('../../../../database/models');
const { logTicketEvent, getSupportRoleIds } = require('../../../utils/ticketUtils');
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
        const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
        const member = guild.members.cache.get(userId);
        const isSlash = interactionOrMessage.isCommand?.();

        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.adminRequired'));
        }

        const config = await TicketConfig.findOne({ where: { guildId: guild.id } });
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfigured'));

        let roleId;
        if (isSlash) {
            const role = interactionOrMessage.options.getRole('role');
            roleId = role?.id;
        } else {
            if (!args[0]) return reply(interactionOrMessage, await tg(guildId, 'ticket.removerole.usage'));
            roleId = args[0].replace(/[<@&>]/g, '');
        }

        if (roleId === config.supportRoleId) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.removerole.cannotRemovePrimary'));
        }

        let additional = [];
        try { additional = JSON.parse(config.additionalRoleIds || '[]'); } catch {}

        if (!additional.includes(roleId)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.removerole.notAdditional', { role: `<@&${roleId}>` }));
        }

        additional = additional.filter(id => id !== roleId);
        config.additionalRoleIds = JSON.stringify(additional);
        await config.save();

        const allRoles = getSupportRoleIds(config);
        const roleList = allRoles.map(id => `<@&${id}>`).join(', ');

        const user = interactionOrMessage.user || interactionOrMessage.author;
        await logTicketEvent(guild, config, 'Support Role Removed', `**Role:** <@&${roleId}>\n**Removed by:** <@${userId}>`);

        return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.removerole.removedTitle')}`, await tg(guildId, 'ticket.removerole.removedBody', { role: `<@&${roleId}>`, roleList }));
    }
};
