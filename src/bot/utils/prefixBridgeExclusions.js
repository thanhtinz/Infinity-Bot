/**
 * Slash command names that must NOT get an auto-generated prefix/text
 * equivalent via `prefixBridge.js`, because positional text args cannot
 * safely represent them.
 *
 * This was populated by scanning every file under `src/bot/commands/**`
 * for: ATTACHMENT (type 11) options, `autocomplete: true` options, and
 * anything that is fundamentally a button/modal driven wizard rather than
 * an options-driven command. As of this writing there is no `autocomplete`
 * usage anywhere under `src/bot/commands/**`, so that category is empty,
 * but the check still runs at bridge time in case one is added later.
 *
 * Add a one-line reason comment next to every entry.
 */

module.exports = new Set([
  // Uses ATTACHMENT options (setAvatar/setBanner image uploads) - a file
  // upload cannot be represented as a positional text argument.
  'server',

  // "reaction" option has `autocomplete: true` (backed by a live gif
  // category list) - text args have no autocomplete UI to resolve against.
  'gif',
]);
