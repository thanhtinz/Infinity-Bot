'use strict';

/**
 * Runs the Discord bot (which also starts the dashboard status/control API on BOT_API_PORT)
 * alongside the web dashboard's Express backend and the owner admin panel's Express backend, as
 * one combined process group.
 *
 * Usage:
 *   node scripts/run-services.js            -> bot + dashboard server + owner-admin server
 *   node scripts/run-services.js --with-vite -> also starts both Vite dev servers for frontend HMR
 *
 * Each child's stdout/stderr is prefixed with a colored label so logs stay distinguishable.
 */

const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const withVite = process.argv.includes('--with-vite');

const COLORS = {
    bot: '\x1b[35m', // magenta
    dashboard: '\x1b[36m', // cyan
    admin: '\x1b[32m', // green
    vite: '\x1b[33m', // yellow
    'admin-vite': '\x1b[33m', // yellow
    reset: '\x1b[0m'
};

const services = [
    { name: 'bot', color: COLORS.bot, command: process.execPath, args: [path.join('src', 'bot', 'index.js')], cwd: root },
    { name: 'dashboard', color: COLORS.dashboard, command: process.execPath, args: [path.join('dashboard', 'server', 'server.js')], cwd: root },
    { name: 'admin', color: COLORS.admin, command: process.execPath, args: [path.join('owner-admin', 'server', 'server.js')], cwd: root }
];

if (withVite) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    services.push({ name: 'vite', color: COLORS.vite, command: npmCommand, args: ['run', 'dev'], cwd: path.join(root, 'dashboard') });
    services.push({ name: 'admin-vite', color: COLORS['admin-vite'], command: npmCommand, args: ['run', 'dev'], cwd: path.join(root, 'owner-admin') });
}

function prefixLines(label, color, chunk) {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter((line, index, all) => line.length > 0 || index < all.length - 1);
    return lines.map((line) => `${color}[${label}]${COLORS.reset} ${line}`).join('\n') + (lines.length ? '\n' : '');
}

const children = [];
let shuttingDown = false;

// Basic auto-respawn, for the bot child only: the owner admin panel's control endpoints
// (src/bot/dashboardApi.js /control/*) already handle graceful restart/stop/start in-process, but
// if the bot process itself dies outright (e.g. an uncaught exception past botLogger's handling),
// the rest of the stack (dashboard + owner admin, which the owner needs in order to see that
// anything is wrong) shouldn't go down with it. A handful of quick restarts almost always means a
// real crash loop (bad token, bad DB), so respawning stops after a few attempts in a short window
// rather than spinning forever.
const BOT_RESPAWN_WINDOW_MS = 60_000;
const BOT_RESPAWN_MAX_ATTEMPTS = 5;
let botRespawnTimestamps = [];

function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
        if (!child.killed) child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(code ?? 0), 500);
}

function spawnService(service) {
    const child = spawn(service.command, service.args, {
        cwd: service.cwd,
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
    });

    child.stdout.on('data', (chunk) => process.stdout.write(prefixLines(service.name, service.color, chunk)));
    child.stderr.on('data', (chunk) => process.stderr.write(prefixLines(service.name, service.color, chunk)));

    child.on('exit', (code) => {
        process.stdout.write(prefixLines(service.name, service.color, `process exited with code ${code}`));

        if (shuttingDown) return;

        if (service.name === 'bot') {
            const now = Date.now();
            botRespawnTimestamps = botRespawnTimestamps.filter((ts) => now - ts < BOT_RESPAWN_WINDOW_MS);
            botRespawnTimestamps.push(now);

            if (botRespawnTimestamps.length > BOT_RESPAWN_MAX_ATTEMPTS) {
                process.stdout.write(prefixLines(service.name, service.color, `crashed ${BOT_RESPAWN_MAX_ATTEMPTS}+ times in ${BOT_RESPAWN_WINDOW_MS / 1000}s - not respawning again, shutting down`));
                return shutdown(code || 1);
            }

            process.stdout.write(prefixLines(service.name, service.color, 'respawning in 2s...'));
            setTimeout(() => {
                if (!shuttingDown) children[children.indexOf(child)] = spawnService(service);
            }, 2000);
            return;
        }

        shutdown(code || 0);
    });

    return child;
}

for (const service of services) {
    children.push(spawnService(service));
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
