


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
  name: 'set',
  description: 'Set a sticky nickname for a member',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Nicknames** permission.', true);

    const targetUser = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember)
      return reply(interaction, 'Not Found', 'Could not find that member in this server.', true);

    if (targetMember.id === interaction.guild.ownerId)
      return reply(interaction, 'Cannot Set Nickname', 'I cannot set a sticky nickname for the server owner.', true);

    if (targetMember.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id)
      return reply(interaction, 'Cannot Set Nickname', 'You cannot set a sticky nickname for someone with an equal or higher role than yours.', true);

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageNicknames))
      return reply(interaction, 'Missing Permissions', 'I need the **Manage Nicknames** permission.', true);

    if (targetMember.roles.highest.position >= me.roles.highest.position)
      return reply(interaction, 'Cannot Set Nickname', 'I cannot change the nickname of someone with an equal or higher role than mine.', true);

    try {
      await StickyNickname.upsert({
        guildId: interaction.guild.id,
        userId: targetMember.id,
        nickname,
        setById: interaction.user.id
      });

      await targetMember.setNickname(nickname, `Sticky nickname set by ${interaction.user.tag}`).catch(() => { });

      await reply(interaction, 'Sticky Nickname Set',
        `${targetMember} will now keep the nickname **${nickname}**. It will be automatically reapplied if changed.`);
    } catch (error) {
      console.error('Stickynick set error:', error);
      await reply(interaction, 'Error', 'Failed to set the sticky nickname. Please try again.', true);
    }
  },
};
