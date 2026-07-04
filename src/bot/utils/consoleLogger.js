const fs = require('fs');
const path = require('path');

function rgb(r, g, b) {
  return (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function badge(br, bg, bb, fr, fg, fb) {
  return (label) =>
    `\x1b[48;2;${br};${bg};${bb}m\x1b[38;2;${fr};${fg};${fb}m ${label} \x1b[0m`;
}

const palette = {
  time: rgb(80, 92, 115),
  msg: rgb(205, 213, 228),
  dim: rgb(65, 75, 95),
  muted: rgb(120, 132, 155),
  white: rgb(236, 239, 244),
  b1: rgb(100, 160, 240),
  b2: rgb(120, 145, 235),
  b3: rgb(145, 130, 225),
  b4: rgb(170, 115, 210),
  b5: rgb(195, 100, 195)
};

const badges = {
  LOAD: badge(45, 70, 155, 180, 205, 255),
  OK: badge(15, 120, 90, 180, 255, 220),
  ERR: badge(155, 38, 38, 255, 205, 205),
  INFO: badge(60, 65, 100, 190, 200, 235),
  WARN: badge(145, 95, 0, 255, 228, 170)
};

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeLog(level, message) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  fs.appendFileSync(LOG_FILE, `[${ts}] [${level}] ${message}\n`, 'utf8');
}

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function emit(badgeFn, label, message) {
  writeLog(label, message);
  process.stdout.write(
    `  ${palette.time(now())}  ${badgeFn(label)}  ${palette.msg(message)}\n`
  );
}

function printHeader() {
  const rule = palette.dim('-'.repeat(62));
  const dot = palette.dim('>');
  const name =
    palette.b1('A') +
    palette.b2('S') +
    palette.b3('T') +
    palette.b4('R') +
    palette.b5('Y') +
    palette.b1('X');

  const lines = [
    '',
    `  ${rule}`,
    `   ${name}`,
    `   ${palette.muted('Multipurpose Discord Bot')}`,
    `  ${rule}`,
    `          ${dot}  ${palette.muted('Ready for launch')}`,
    `  ${rule}`,
    ''
  ];

  for (const line of lines) process.stdout.write(line + '\n');
}

function printLoading(message) {
  emit(badges.LOAD, 'LOAD', message);
}

function printSuccess(message) {
  emit(badges.OK, 'OK  ', message);
}

function printError(message) {
  emit(badges.ERR, 'ERR ', message);
}

function printInfo(message) {
  emit(badges.INFO, 'INFO', message);
}

function printWarn(message) {
  emit(badges.WARN, 'WARN', message);
}

function printSystemReady() {
  const rule = palette.dim('-'.repeat(62));
  process.stdout.write('\n');
  process.stdout.write(`  ${rule}\n`);
  process.stdout.write(
    `  ${palette.b1('*')}  ${palette.white('System online')}  ${palette.dim('-')}  ${palette.muted('Infinity Bot is operational')}\n`
  );
  process.stdout.write(`  ${rule}\n`);
  process.stdout.write('\n');
}

const colors = {
  PURPLE: '\x1b[38;2;170;115;210m',
  YELLOW: '\x1b[38;2;250;200;80m',
  RESET: '\x1b[0m'
};

module.exports = {
  colors,
  printHeader,
  printLoading,
  printSuccess,
  printError,
  printInfo,
  printWarn,
  printSystemReady
};
