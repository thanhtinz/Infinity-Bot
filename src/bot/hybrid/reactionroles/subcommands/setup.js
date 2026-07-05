const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const ReactionRoles = require('../../../../database/models/ReactionRoles');
const { tg } = require('../../../utils/i18n');

module.exports = {
  name: 'reactionroles',
  description: 'Setup and manage reaction roles',

  async execute(interaction) {
    const guildId = interaction.guild.id;
    if (!interaction.member.permissions.has('ManageGuild')) {
      return interaction.reply({
        content: await tg(guildId, 'reactionroles.noPermission'),
        flags: MessageFlags.Ephemeral
      });
    }


    if (!interaction.client.reactionRolesSetup) {
      interaction.client.reactionRolesSetup = new Map();
    }

    await this.step1(interaction);
  },

  async step1(interaction) {
    const userId = interaction.user?.id ?? interaction.author?.id;
    const guildId = interaction.guild.id;

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'reactionroles.setup.step1Title')}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'reactionroles.setup.step1Prompt'))
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`rr_channel_select_${userId}`)
            .setPlaceholder('Select a text channel')
            .setChannelTypes(ChannelType.GuildText)
            .setMinValues(1)
            .setMaxValues(1)
        )
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  },

  async step2(interaction, channelId) {
    const guildId = interaction.guild.id;

    if (!interaction.client.reactionRolesSetup) {
      interaction.client.reactionRolesSetup = new Map();
    }

    interaction.client.reactionRolesSetup.set(interaction.user.id, {
      guildId: interaction.guild.id,
      channelId: channelId,
      emojiRolePairs: []
    });

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'reactionroles.setup.step2Title')}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(await tg(guildId, 'reactionroles.setup.step2Prompt'))
      );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rr_add_pair_${interaction.user.id}`)
        .setLabel('Add Emoji-Role')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rr_step2_continue_${interaction.user.id}`)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rr_setup_cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      components: [container, buttonRow],
      flags: MessageFlags.IsComponentsV2
    });
  },

  async step3(interaction) {
    const guildId = interaction.guild.id;

    if (!interaction.client.reactionRolesSetup?.has(interaction.user.id)) {
      return interaction.reply({
        content: await tg(guildId, 'reactionroles.setup.sessionExpired'),
        flags: MessageFlags.Ephemeral
      });
    }

    const session = interaction.client.reactionRolesSetup.get(interaction.user.id);

    if (session.emojiRolePairs.length === 0) {
      return interaction.reply({
        content: await tg(guildId, 'reactionroles.setup.needAtLeastOnePair'),
        flags: MessageFlags.Ephemeral
      });
    }


    let pairsSummary = '';
    for (const pair of session.emojiRolePairs) {
      pairsSummary += `${pair.emoji} → <@&${pair.roleId}>\n`;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'reactionroles.setup.step3Title')}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          await tg(guildId, 'reactionroles.setup.step3Body', { channel: `<#${session.channelId}>`, pairs: pairsSummary })
        )
      );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rr_setup_confirm_${interaction.user.id}`)
        .setLabel('Confirm & Post')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rr_setup_back_${interaction.user.id}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rr_setup_cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      components: [container, buttonRow],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
