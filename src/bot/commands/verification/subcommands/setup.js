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
const { tg } = require('../../../utils/i18n');

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
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, await tg(guildId, 'common.permissionDenied'), await tg(guildId, 'common.youNeedPermission', { permission: 'Manage Server' }), true);

    const channel = interaction.options.getChannel('channel');
    const verifiedRole = interaction.options.getRole('verified_role');
    const unverifiedRole = interaction.options.getRole('unverified_role');
    const message = interaction.options.getString('message');

    const me = interaction.guild.members.me;

    if (verifiedRole.managed)
      return reply(interaction, await tg(guildId, 'verification.setup.invalidRoleTitle'), await tg(guildId, 'verification.setup.verifiedManaged'), true);

    if (verifiedRole.position >= me.roles.highest.position)
      return reply(interaction, await tg(guildId, 'verification.setup.invalidRoleTitle'), await tg(guildId, 'verification.setup.verifiedTooHighMe'), true);

    if (verifiedRole.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id)
      return reply(interaction, await tg(guildId, 'verification.setup.invalidRoleTitle'), await tg(guildId, 'verification.setup.verifiedTooHighYou'), true);

    if (unverifiedRole) {
      if (unverifiedRole.managed)
        return reply(interaction, await tg(guildId, 'verification.setup.invalidRoleTitle'), await tg(guildId, 'verification.setup.unverifiedManaged'), true);

      if (unverifiedRole.position >= me.roles.highest.position)
        return reply(interaction, await tg(guildId, 'verification.setup.invalidRoleTitle'), await tg(guildId, 'verification.setup.unverifiedTooHighMe'), true);
    }

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
      return reply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'verification.setup.missingRolePermission'), true);

    if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
      return reply(interaction, await tg(guildId, 'common.missingPermissions'), await tg(guildId, 'verification.setup.missingChannelPermission', { channel: `${channel}` }), true);

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

      const noneRole = await tg(guildId, 'verification.setup.noneRole');
      await reply(interaction, await tg(guildId, 'verification.setup.enabledTitle'),
        await tg(guildId, 'verification.setup.enabledBody', {
          channel: `${channel}`,
          verifiedRole: `${verifiedRole}`,
          unverifiedRole: unverifiedRole ? `${unverifiedRole}` : noneRole,
        }));
    } catch (error) {
      console.error('Verification setup error:', error);
      await reply(interaction, await tg(guildId, 'common.error'), await tg(guildId, 'verification.setup.errorGeneric'), true);
    }
  },
};
