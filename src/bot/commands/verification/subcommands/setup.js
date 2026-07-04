


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { VerificationConfig } = require('../../../../database/models');
const { postVerificationPanel } = require('../../../utils/verificationPanel');

function reply(interaction, title, body, ephemeral = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'setup',
  description: 'Set up the verification gate for this server',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.', true);

    const channel = interaction.options.getChannel('channel');
    const verifiedRole = interaction.options.getRole('verified_role');
    const unverifiedRole = interaction.options.getRole('unverified_role');
    const message = interaction.options.getString('message');

    const me = interaction.guild.members.me;

    if (verifiedRole.managed)
      return reply(interaction, 'Invalid Role', 'The verified role you provided is managed by an integration.', true);

    if (verifiedRole.position >= me.roles.highest.position)
      return reply(interaction, 'Invalid Role', 'The verified role you provided is higher than or equal to my highest role.', true);

    if (verifiedRole.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id)
      return reply(interaction, 'Invalid Role', 'The verified role you provided is higher than or equal to your highest role.', true);

    if (unverifiedRole) {
      if (unverifiedRole.managed)
        return reply(interaction, 'Invalid Role', 'The unverified role you provided is managed by an integration.', true);

      if (unverifiedRole.position >= me.roles.highest.position)
        return reply(interaction, 'Invalid Role', 'The unverified role you provided is higher than or equal to my highest role.', true);
    }

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
      return reply(interaction, 'Missing Permissions', 'I need the **Manage Roles** permission to assign roles.', true);

    if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
      return reply(interaction, 'Missing Permissions', `I need permission to view and send messages in ${channel}.`, true);

    try {
      const [config] = await VerificationConfig.findOrCreate({
        where: { guildId: interaction.guild.id },
        defaults: { guildId: interaction.guild.id }
      });

      config.enabled = true;
      config.channelId = channel.id;
      config.verifiedRoleId = verifiedRole.id;
      config.unverifiedRoleId = unverifiedRole?.id || null;
      config.message = message || null;
      await config.save();

      await postVerificationPanel(config, interaction.guild);

      await reply(interaction, 'Verification Enabled',
        `**Channel:** ${channel}\n**Verified Role:** ${verifiedRole}\n**Unverified Role:** ${unverifiedRole ? unverifiedRole : 'None'}\n\nThe verify panel has been posted.`);
    } catch (error) {
      console.error('Verification setup error:', error);
      await reply(interaction, 'Error', 'Failed to set up verification. Please check my permissions and try again.', true);
    }
  },
};
