

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function isValidDate(day, month) {
    if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const daysInMonth = new Date(2024, month, 0).getDate();
    return day <= daysInMonth;
}

function formatBirthday(day, month, year) {
    const monthName = MONTH_NAMES[month - 1] || 'Unknown';
    return year ? `${monthName} ${day}, ${year}` : `${monthName} ${day}`;
}

function replacePlaceholders(text, member) {
    if (!text) return text;
    return text
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{username\}/g, member.user.username);
}

module.exports = {
    MONTH_NAMES,
    isValidDate,
    formatBirthday,
    replacePlaceholders
};
