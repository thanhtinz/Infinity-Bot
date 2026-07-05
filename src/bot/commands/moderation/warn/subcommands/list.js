const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { ModLog } = require('../../../../../database/models');
const { createPaginationSession } = require('../../../../utils/pagination');
const { tg } = require('../../../../utils/i18n');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'list',
  description: 'List warnings for a user',

  async execute(interaction) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('user');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Moderate Members' }), true);

    await interaction.deferReply();

    const warns = await ModLog.findAll({
      where: { guildId: interaction.guild.id, targetId: targetUser.id, action: 'warn' },
      order: [['createdAt', 'DESC']]
    });

    if (warns.length === 0) {
      const title = await tg(guildId, 'warn.list.titleFor', { user: targetUser.tag });
      const body = await tg(guildId, 'warn.list.noWarnings');
      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(warns.length / itemsPerPage);
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      pages.push(warns.slice(i * itemsPerPage, (i + 1) * itemsPerPage));
    }

    const noReason = await tg(guildId, 'common.noReasonProvided');
    const titleCount = await tg(guildId, 'warn.list.titleForCount', { user: targetUser.tag, count: warns.length });
    const entryTemplates = await Promise.all(warns.map(warn => tg(guildId, 'warn.list.entry', {
      caseNumber: warn.caseNumber,
      moderator: warn.moderatorTag,
      reason: warn.reason || noReason,
      date: `<t:${Math.floor(new Date(warn.createdAt).getTime() / 1000)}:f>`,
    })));

    const paginationSession = createPaginationSession({
      interactionOrMessage: interaction,
      pages,
      renderPage: (pageIndex, pageData) => {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${titleCount}**`))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const startIndex = pageIndex * itemsPerPage;
        const list = pageData.map((warn, i) => entryTemplates[startIndex + i]).join('\n\n');

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));
        return container;
      },
      userId: interaction.user.id,
      timeout: 300000
    });

    await paginationSession.renderInitial();
  },
};
