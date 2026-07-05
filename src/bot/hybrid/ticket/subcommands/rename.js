
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

        let newNameInput;
        if (isSlash) {
            newNameInput = interactionOrMessage.options.getString('name');
        } else {
            if (!args[0]) return reply(interactionOrMessage, await tg(guildId, 'ticket.rename.usage'));
            newNameInput = args.join(' ');
        }

        const [ticket, config] = await Promise.all([
            Ticket.findOne({ where: { channelId: channel.id } }),
            TicketConfig.findOne({ where: { guildId: guild.id } })
        ]);
        if (!ticket) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.invalidTicketChannel'));
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfiguredPlain'));

        const member = guild.members.cache.get(userId);
        if (!hasSupportRole(member, config)) {
            return reply(interactionOrMessage, await tg(guildId, 'ticket.rename.noPermission'));
        }

        try {
            const newName = newNameInput.toLowerCase()
                .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                .replace(/--+/g, '-').replace(/^-|-$/g, '')
                .substring(0, 100);

            if (!newName) return reply(interactionOrMessage, await tg(guildId, 'ticket.rename.invalidName'));
            if (channel.name === newName) return reply(interactionOrMessage, await tg(guildId, 'ticket.rename.sameName'));

            const oldName = channel.name;
            const user = interactionOrMessage.user || interactionOrMessage.author;
            await channel.setName(newName, `Ticket renamed by ${user.tag}`);

            logTicketEvent(guild, config, 'Ticket Renamed', `**Ticket:** <#${channel.id}>\n**Old Name:** ${oldName}\n**New Name:** ${newName}\n**Renamed by:** <@${userId}>`).catch(() => {});

            return replyTitled(interactionOrMessage, `### ${await tg(guildId, 'ticket.rename.renamedTitle')}`, await tg(guildId, 'ticket.rename.renamedBody', { name: newName }));
        } catch (error) {
            console.error('Ticket rename error:', error);
            let msg = await tg(guildId, 'ticket.rename.failed');
            if (error.code === 50013) msg = await tg(guildId, 'ticket.rename.missingPermissions');
            else if (error.code === 50029) msg = await tg(guildId, 'ticket.rename.rateLimited');
            return reply(interactionOrMessage, msg);
        }
    }
};
