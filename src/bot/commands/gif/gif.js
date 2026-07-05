


const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');
const { listReactions, getGif } = require('../../utils/otakuGifsClient');

function capitalize(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function reply(interaction, container, ephemeral = false) {
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    ephemeral,
  });
}

function errorContainer(title, body) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Send a random anime reaction GIF')
    .addStringOption((option) =>
      option
        .setName('reaction')
        .setDescription('The reaction category (e.g. hug, pat, cry)')
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Optional user to direct the reaction at')
        .setRequired(false)),

  category: 'roleplay',

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused().toLowerCase();
      const reactions = await listReactions();
      const filtered = focused
        ? reactions.filter((r) => r.startsWith(focused))
        : reactions;
      const choices = (filtered.length > 0 ? filtered : reactions).slice(0, 25);
      await interaction.respond(choices.map((r) => ({ name: r, value: r })));
    } catch (error) {
      // Autocomplete failures should never surface to the user; Discord
      // just shows no suggestions if we don't respond in time.
    }
  },

  async execute(interaction) {
    const reactionInput = interaction.options.getString('reaction', true).toLowerCase().trim();
    const targetUser = interaction.options.getUser('user');
    const author = interaction.user;

    if (targetUser && targetUser.id === author.id) {
      return reply(interaction, errorContainer(
        'Invalid Target',
        'You cannot target yourself with this command.'
      ), true);
    }

    await interaction.deferReply({ flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

    const reactions = await listReactions();
    if (!reactions.includes(reactionInput)) {
      const suggestions = reactions.slice(0, 15).map((r) => `\`${r}\``).join(', ');
      return interaction.editReply({
        components: [errorContainer(
          'Unknown Reaction',
          `\`${reactionInput}\` is not a supported reaction.\nTry one of: ${suggestions}, and more (use tab-complete on \`/gif\`).`
        )],
        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
      });
    }

    const gifUrl = await getGif(reactionInput);
    const label = capitalize(reactionInput);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${label}`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    if (gifUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems([
          new MediaGalleryItemBuilder().setURL(gifUrl),
        ])
      );
    }

    const line = targetUser
      ? `**${author.username}** sends a **${reactionInput}** to **${targetUser.username}**!`
      : `**${author.username}** is feeling **${reactionInput}**!`;

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));

    if (!gifUrl) {
      container
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('-# GIF service is unavailable right now, showing text only.'));
    }

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
    });
  },
};
