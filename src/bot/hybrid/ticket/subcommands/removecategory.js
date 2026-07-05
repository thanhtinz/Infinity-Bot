
const {
    PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    SeparatorSpacingSize, ActionRowBuilder, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, MessageFlags
} = require('discord.js');
const { TicketConfig, TicketCategory } = require('../../../../database/models');
const { logTicketEvent, refreshPanel } = require('../../../utils/ticketUtils');
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
        if (!config) return reply(interactionOrMessage, await tg(guildId, 'ticket.shared.notConfigured'));

        const categories = await TicketCategory.findAll({ where: { guildId: guild.id }, order: [['id', 'ASC']] });
        if (categories.length === 0) return reply(interactionOrMessage, await tg(guildId, 'ticket.removecategory.noCategories'));

        const options = categories.map(cat =>
            new StringSelectMenuOptionBuilder()
                .setLabel(cat.categoryName.substring(0, 25))
                .setValue(String(cat.id))
                .setDescription(`ID: ${cat.id}`)
        );

        const selectContainer = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.removecategory.promptTitle')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${await tg(guildId, 'ticket.removecategory.promptBody')}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ticket_removecat_select').setPlaceholder('Select category...').setMaxValues(1).addOptions(options)
            ));

        const msg = await (interactionOrMessage.isCommand?.()
            ? interactionOrMessage.reply({ components: [selectContainer], flags: MessageFlags.IsComponentsV2 })
            : interactionOrMessage.reply({ components: [selectContainer], flags: MessageFlags.IsComponentsV2 }));
        const sentMsg = msg || await interactionOrMessage.fetchReply?.() || await interactionOrMessage.channel.messages.fetch({ limit: 1 }).then(m => m.first());

        try {
            const selectInteraction = await sentMsg.awaitMessageComponent({
                filter: i => i.customId === 'ticket_removecat_select' && i.user.id === userId,
                time: 60000
            });

            const catId = selectInteraction.values[0];
            const category = categories.find(c => String(c.id) === catId);
            if (!category) {
                return selectInteraction.update({ components: [new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'ticket.removecategory.categoryNotFound')))] });
            }

            const catName = category.categoryName;
            await category.destroy();
            await logTicketEvent(guild, config, 'Category Removed', `**Category:** ${catName}\n**Removed by:** <@${userId}>`);
            refreshPanel(guild, config).catch(() => {});

            const doneContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.removecategory.removedTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${await tg(guildId, 'ticket.removecategory.removedBody', { name: catName })}`));
            await selectInteraction.update({ components: [doneContainer] });
        } catch {
            const expiredContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'ticket.removecategory.promptTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${await tg(guildId, 'ticket.shared.timedOut')}`));
            await sentMsg.edit({ components: [expiredContainer] }).catch(() => {});
        }
    }
};
