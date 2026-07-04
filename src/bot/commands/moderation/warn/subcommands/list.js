


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
    const targetUser = interaction.options.getUser('user');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, 'Permission Denied', 'You need the **Moderate Members** permission.', true);

    await interaction.deferReply();

    const warns = await ModLog.findAll({
      where: { guildId: interaction.guild.id, targetId: targetUser.id, action: 'warn' },
      order: [['createdAt', 'DESC']]
    });

    if (warns.length === 0) {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Warnings for ${targetUser.tag}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('No warnings found for this user.'));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(warns.length / itemsPerPage);
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      pages.push(warns.slice(i * itemsPerPage, (i + 1) * itemsPerPage));
    }

    const paginationSession = createPaginationSession({
      interactionOrMessage: interaction,
      pages,
      renderPage: (pageIndex, pageData) => {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Warnings for ${targetUser.tag} [${warns.length}]**`))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const list = pageData.map(warn =>
          `\`#${warn.caseNumber}\` **Moderator:** ${warn.moderatorTag}\n**Reason:** ${warn.reason || 'No reason provided'}\n**Date:** <t:${Math.floor(new Date(warn.createdAt).getTime() / 1000)}:f>`
        ).join('\n\n');

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));
        return container;
      },
      userId: interaction.user.id,
      timeout: 300000
    });

    await paginationSession.renderInitial();
  },
};
