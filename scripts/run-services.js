'use strict';

/**
 * Runs the Discord bot (which also starts the dashboard status API on BOT_API_PORT) alongside
 * the web dashboard's Express backend, as one combined process group.
 *
 * Usage:
 *   node scripts/run-services.js            -> bot + dashboard server (serves dashboard/dist)
 *   node scripts/run-services.js --with-vite -> also starts the Vite dev server for frontend HMR
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
    vite: '\x1b[33m', // yellow
    reset: '\x1b[0m'
};

const services = [
    { name: 'bot', color: COLORS.bot, command: process.execPath, args: [path.join('src', 'bot', 'index.js')], cwd: root },
    { name: 'dashboard', color: COLORS.dashboard, command: process.execPath, args: [path.join('dashboard', 'server', 'server.js')], cwd: root }
];

if (withVite) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    services.push({ name: 'vite', color: COLORS.vite, command: npmCommand, args: ['run', 'dev'], cwd: path.join(root, 'dashboard') });
}

function prefixLines(label, color, chunk) {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter((line, index, all) => line.length > 0 || index < all.length - 1);
    return lines.map((line) => `${color}[${label}]${COLORS.reset} ${line}`).join('\n') + (lines.length ? '\n' : '');
}

const children = [];
let shuttingDown = false;

function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
        if (!child.killed) child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(code ?? 0), 500);
}

for (const service of services) {
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
        shutdown(code || 0);
    });

    children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
