

function parseEmojiId(emojiString) {
    const match = /^<a?:(\w+):(\d+)>$/.exec(emojiString || '');
    return match ? { name: match[1], id: match[2] } : null;
}

function emojiMatches(configEmoji, reactionEmoji) {
    const parsed = parseEmojiId(configEmoji);
    if (parsed) {
        return reactionEmoji.id === parsed.id;
    }
    return reactionEmoji.name === configEmoji || reactionEmoji.toString() === configEmoji;
}

module.exports = {
    parseEmojiId,
    emojiMatches
};
