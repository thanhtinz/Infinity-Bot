


const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const { Birthday } = require('../../../../database/models');
const { isValidDate, formatBirthday } = require('../../../utils/birthdayUtils');

function reply(interaction, title, body, ephemeral = true) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral });
}

module.exports = {
  name: 'set',
  description: 'Set your birthday',

  async execute(interaction) {
    const day = interaction.options.getInteger('day');
    const month = interaction.options.getInteger('month');
    const year = interaction.options.getInteger('year');

    if (!isValidDate(day, month))
      return reply(interaction, 'Invalid Date', 'That is not a valid day/month combination.');

    const [birthday, created] = await Birthday.findOrCreate({
      where: { userId: interaction.user.id, guildId: interaction.guild.id },
      defaults: { userId: interaction.user.id, guildId: interaction.guild.id, day, month, year: year || null }
    });

    if (!created) {
      birthday.day = day;
      birthday.month = month;
      birthday.year = year || null;
      birthday.lastAnnouncedYear = null;
      await birthday.save();
    }

    await reply(interaction, 'Birthday Set', `Your birthday has been set to **${formatBirthday(day, month, year)}**.`);
  },
};
