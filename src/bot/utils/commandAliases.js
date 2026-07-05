/**
 * Shared alias table: slash command name -> array of short prefix aliases.
 *
 * Consumed by `prefixBridge.js` (auto-bridged slash commands) and, where it
 * makes sense, by existing prefix/hybrid commands that don't already define
 * their own aliases. This is not an exhaustive list of every command in the
 * bot - it only covers commands people would actually want a short alias
 * for (moderation actions, info lookups, frequently used utility/fun
 * commands, etc).
 *
 * Keys are the top-level command name exactly as registered in
 * `client.commands` / `client.prefixCommands` (i.e. `SlashCommandBuilder`
 * `.setName(...)` for slash-only commands).
 */

module.exports = {
  // Moderation
  kick: ['k'],
  ban: ['b'],
  softban: ['sb'],
  unban: ['ub'],
  tempban: ['tb'],
  mute: ['m', 'timeout'],
  unmute: ['um', 'untimeout'],
  warn: ['w'],
  warnpunish: ['wp'],
  case: ['modcase'],
  temprole: ['tr'],
  slowmode: ['sm'],
  lock: ['lc'],
  unlock: ['ulc'],

  // Info / profile lookups
  userinfo: ['ui', 'whois'],
  serverinfo: ['si', 'guildinfo'],
  avatar: ['av', 'pfp'],
  banner: ['bn'],
  botinfo: ['bi', 'about'],
  botstats: ['bstats'],
  ping: ['latency'],
  invite: ['inv'],
  users: ['userscount'],

  // Server management
  verification: ['verify', 'vgate'],
  starboard: ['sb-config', 'stars'],
  statschannel: ['statsch'],
  stickynick: ['sticky', 'snick'],
  ignore: ['ig'],

  // Giveaway / community
  giveaway: ['gw'],
  ticket: ['tix'],

  // Fun
  meme: ['mm'],
  rizz: ['pickuplinerz'],
  truth: ['t'],
  dare: ['d'],

  // Misc utility
  calc: ['calculator'],
  define: ['def'],
  afk: ['away'],

  // Help
  help: ['h', 'commands'],
};
