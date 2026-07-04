


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const { Birthday } = require('../../../../database/models');
const { formatBirthday } = require('../../../utils/birthdayUtils');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'view',
  description: 'View a birthday',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const birthday = await Birthday.findOne({ where: { userId: targetUser.id, guildId: interaction.guild.id } });

    if (!birthday)
      return reply(interaction, 'Birthday', `**${targetUser.tag}** has not set a birthday in this server.`);

    await reply(interaction, 'Birthday', `**${targetUser.tag}**'s birthday is **${formatBirthday(birthday.day, birthday.month, birthday.year)}**.`, false);
  },
};
