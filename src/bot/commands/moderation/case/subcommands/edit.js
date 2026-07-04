


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { ModLog } = require('../../../../../database/models');

function modReply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'edit',
  description: 'Edit the reason of a moderation case',

  async execute(interaction) {
    const caseNumber = interaction.options.getInteger('case_number');
    const reason = interaction.options.getString('reason');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
      return modReply(interaction, 'Permission Denied', 'You need the **Moderate Members** permission.', true);

    const modCase = await ModLog.findOne({
      where: { guildId: interaction.guild.id, caseNumber }
    });

    if (!modCase)
      return modReply(interaction, 'Case Not Found', `No case with number **#${caseNumber}** exists in this server.`, true);

    modCase.reason = reason;
    await modCase.save();

    await modReply(interaction, 'Case Updated', `**Case #${caseNumber}** reason updated to:\n${reason}`);
  },
};
