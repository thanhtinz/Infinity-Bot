


const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { AntinukeConfig } = require('../../../../database/models');
const { tg } = require('../../../utils/i18n');

module.exports = {
    name: 'setup',
    description: 'Setup antinuke with interactive wizard',

    async execute(interactionOrMessage) {
        const member = interactionOrMessage.member;
        const guild = interactionOrMessage.guild;
        const guildId = guild.id;

        if (guild.ownerId !== member.id) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.ownerOnlySetup'))
                );
            return interactionOrMessage.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const existingConfig = await AntinukeConfig.findOne({ where: { guildId: guild.id } });
        if (existingConfig) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${await tg(guildId, 'antinuke.alreadyConfiguredTitle')}`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(await tg(guildId, 'antinuke.alreadyConfiguredBody')));
            return interactionOrMessage.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const [config] = await AntinukeConfig.findOrCreate({ where: { guildId: guild.id }, defaults: { guildId: guild.id } });

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('# Antinuke Setup\n**Step 1 of 3** - Select Modules')
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('Select which protection modules to enable:')
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('antinuke_setup_modules')
                        .setPlaceholder('Select modules to enable')
                        .setMinValues(0)
                        .setMaxValues(11)
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Ban')
                                .setDescription('Prevent mass banning of members')
                                .setValue('antiBan')
                                .setDefault(config.antiBan),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Kick')
                                .setDescription('Prevent mass kicking of members')
                                .setValue('antiKick')
                                .setDefault(config.antiKick),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Channel Create')
                                .setDescription('Prevent mass channel creation')
                                .setValue('antiChannelCreate')
                                .setDefault(config.antiChannelCreate),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Channel Delete')
                                .setDescription('Prevent mass channel deletion')
                                .setValue('antiChannelDelete')
                                .setDefault(config.antiChannelDelete),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Channel Edit')
                                .setDescription('Prevent mass channel modifications')
                                .setValue('antiChannelEdit')
                                .setDefault(config.antiChannelEdit),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Role Create')
                                .setDescription('Prevent mass role creation')
                                .setValue('antiRoleCreate')
                                .setDefault(config.antiRoleCreate),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Role Delete')
                                .setDescription('Prevent mass role deletion')
                                .setValue('antiRoleDelete')
                                .setDefault(config.antiRoleDelete),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Role Update')
                                .setDescription('Prevent dangerous permission grants')
                                .setValue('antiRoleUpdate')
                                .setDefault(config.antiRoleUpdate),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Webhook')
                                .setDescription('Prevent unauthorized webhook creation')
                                .setValue('antiWebhook')
                                .setDefault(config.antiWebhook),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Bot')
                                .setDescription('Prevent unauthorized bot additions')
                                .setValue('antiBot')
                                .setDefault(config.antiBot),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Anti-Emoji')
                                .setDescription('Prevent emoji creation/deletion/modification')
                                .setValue('antiEmoji')
                                .setDefault(config.antiEmoji)
                        )
                )
            )
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('antinuke_setup_next_1')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('antinuke_setup_cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                )
            );

        return interactionOrMessage.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
};
