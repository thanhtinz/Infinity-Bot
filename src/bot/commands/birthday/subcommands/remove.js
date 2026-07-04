


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const { Birthday } = require('../../../../database/models');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'remove',
  description: 'Remove your saved birthday',

  async execute(interaction) {
    const birthday = await Birthday.findOne({ where: { userId: interaction.user.id, guildId: interaction.guild.id } });

    if (!birthday)
      return reply(interaction, 'Not Found', 'You do not have a birthday set in this server.');

    await birthday.destroy();

    await reply(interaction, 'Birthday Removed', 'Your saved birthday has been removed.');
  },
};
