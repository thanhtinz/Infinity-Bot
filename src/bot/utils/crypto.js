const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const raw = config.ENCRYPTION_KEY;
    if (!raw) throw new Error('ENCRYPTION_KEY is not configured');
    // Accept either a 64-char hex string (32 bytes) or derive one from any passphrase.
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
    return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decrypt(payload) {
    const key = getKey();
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function maskKey(plaintext) {
    if (!plaintext) return null;
    const str = String(plaintext);
    if (str.length <= 4) return '*'.repeat(str.length);
    return `${'*'.repeat(Math.max(0, str.length - 4))}${str.slice(-4)}`;
}

module.exports = { encrypt, decrypt, maskKey };
