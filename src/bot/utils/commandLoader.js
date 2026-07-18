const fs = require('fs');
const path = require('path');

function getAllJsFiles(dir, skipSubcommandsDirs = false) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipSubcommandsDirs && entry.name === 'subcommands') continue;
            files.push(...getAllJsFiles(fullPath, skipSubcommandsDirs));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

function loadSlashCommands(client, commandsPath) {
    const files = getAllJsFiles(commandsPath, true);
    let loaded = 0;
    const errors = [];

    for (const filePath of files) {
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                loaded++;
            }
        } catch (error) {
            errors.push(`${path.relative(commandsPath, filePath)}: ${error.message}`);
        }
    }

    console.log(`[commands] loaded ${loaded} slash commands`);
    if (errors.length) errors.forEach((e) => console.error(`[commands] failed to load ${e}`));
    return { loaded, errors };
}

function loadEvents(client, eventsPath) {
    if (!fs.existsSync(eventsPath)) return { loaded: 0 };
    let loaded = 0;
    for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
        const event = require(path.join(eventsPath, file));
        if ('name' in event && 'execute' in event) {
            if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
            else client.on(event.name, (...args) => event.execute(...args, client));
            loaded++;
        }
    }
    console.log(`[events] loaded ${loaded} events`);
    return { loaded };
}

module.exports = { getAllJsFiles, loadSlashCommands, loadEvents };
