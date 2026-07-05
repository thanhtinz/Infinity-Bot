const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const GuildLanguage = require('../../../database/models/GuildLanguage');
const { tg } = require('../../utils/i18n');

function reply(interactionOrMessage, title, body, ephemeral = false) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    return interactionOrMessage.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        ephemeral
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription("Set or view this server's bot reply language")
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription("Set this server's bot reply language")
                .addStringOption(option =>
                    option
                        .setName('language')
                        .setDescription('The language to use for bot replies in this server')
                        .setRequired(true)
                        .addChoices(
                            { name: 'English', value: 'en' },
                            { name: 'Tiếng Việt', value: 'vi' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription("View this server's current bot reply language")
        ),

    name: 'language',
    aliases: ['lang'],
    description: "Set or view this server's bot reply language",

    async execute(interactionOrMessage, args = []) {
        const isSlash = interactionOrMessage.isCommand?.();
        const guildId = interactionOrMessage.guildId ?? interactionOrMessage.guild?.id;

        let action, langArg;

        if (isSlash) {
            action = interactionOrMessage.options.getSubcommand();
            langArg = action === 'set' ? interactionOrMessage.options.getString('language') : null;
        } else {
            action = args[0]?.toLowerCase();
            langArg = args[1]?.toLowerCase();

            if (!action || !['set', 'view'].includes(action)) {
                return reply(
                    interactionOrMessage,
                    await tg(guildId, 'common.error'),
                    await tg(guildId, 'language.usage'),
                    false
                );
            }
        }

        if (action === 'view') {
            const currentLang = await GuildLanguage.getLanguage(guildId);
            const languageName = await tg(guildId, `language.names.${currentLang}`);
            return reply(
                interactionOrMessage,
                await tg(guildId, 'language.viewTitle'),
                await tg(guildId, 'language.viewBody', { language: languageName }),
                isSlash
            );
        }

        // action === 'set'
        const member = interactionOrMessage.member;
        if (!member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(
                interactionOrMessage,
                await tg(guildId, 'common.permissionDenied'),
                await tg(guildId, 'language.noPermission'),
                true
            );
        }

        if (!langArg || !GuildLanguage.SUPPORTED_LANGUAGES.includes(langArg)) {
            return reply(
                interactionOrMessage,
                await tg(guildId, 'common.error'),
                await tg(guildId, 'language.notSupported'),
                true
            );
        }

        try {
            await GuildLanguage.setLanguage(guildId, langArg);

            const languageName = await tg(guildId, `language.names.${langArg}`);
            return reply(
                interactionOrMessage,
                await tg(guildId, 'language.setTitle'),
                await tg(guildId, 'language.setBody', { language: languageName }),
                isSlash
            );
        } catch (error) {
            console.error('Language set error:', error);
            return reply(
                interactionOrMessage,
                await tg(guildId, 'common.error'),
                await tg(guildId, 'common.genericError'),
                true
            );
        }
    }
};
