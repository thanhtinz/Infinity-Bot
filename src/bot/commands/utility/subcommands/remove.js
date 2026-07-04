


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { StickyNickname } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'remove',
  description: 'Remove the sticky nickname from a member',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Nicknames** permission.', true);

    const targetUser = interaction.options.getUser('user');

    try {
      const record = await StickyNickname.findOne({ where: { guildId: interaction.guild.id, userId: targetUser.id } });

      if (!record)
        return reply(interaction, 'Not Found', 'That member does not have a sticky nickname set.', true);

      await record.destroy();

      await reply(interaction, 'Sticky Nickname Removed', `The sticky nickname for <@${targetUser.id}> has been removed.`);
    } catch (error) {
      console.error('Stickynick remove error:', error);
      await reply(interaction, 'Error', 'Failed to remove the sticky nickname. Please try again.', true);
    }
  },
};
