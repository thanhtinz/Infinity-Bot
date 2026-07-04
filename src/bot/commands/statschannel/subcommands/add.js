


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { StatsChannelConfig } = require('../../../../database/models');
const { VALID_TYPES, defaultTemplate, updateStatsChannel } = require('../../../utils/statsChannelUtils');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'add',
  description: 'Add a stats counter channel',

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const template = interaction.options.getString('template');

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return reply(interaction, 'Permission Denied', 'You need the **Manage Server** permission.');

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
      return reply(interaction, 'Missing Permissions', 'I need the **Manage Channels** permission.');

    if (!VALID_TYPES.includes(type))
      return reply(interaction, 'Invalid Type', 'That is not a valid stats type.');

    if (type === 'roleCount' && !role)
      return reply(interaction, 'Missing Role', 'You must provide a role when using the **Role Count** type.');

    if (template && !template.includes('{count}'))
      return reply(interaction, 'Invalid Template', 'Your template must contain a `{count}` placeholder.');

    const existing = await StatsChannelConfig.findOne({ where: { channelId: channel.id } });
    if (existing)
      return reply(interaction, 'Already Configured', 'That channel is already a stats channel. Remove it first to reconfigure.');

    const config = await StatsChannelConfig.create({
      guildId: interaction.guild.id,
      channelId: channel.id,
      type,
      roleId: type === 'roleCount' ? role.id : null,
      nameTemplate: template || defaultTemplate(type),
    });

    await updateStatsChannel(interaction.guild, config).catch(() => {});

    await reply(interaction, 'Stats Channel Added',
      `${channel} will now display **${type}** counts.\n**Template:** \`${config.nameTemplate}\`\n\nIt updates roughly every 10 minutes due to Discord rate limits.`);
  },
};
