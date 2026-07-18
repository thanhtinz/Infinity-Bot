const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const PDFDocument = require('pdfkit');
const ai = require('../../utils/ai');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // Discord default attachment limit

const FORMAT_CHOICES = [
    { name: 'Plain text (.txt)', value: 'txt' },
    { name: 'Markdown (.md)', value: 'md' },
    { name: 'Word document (.docx)', value: 'docx' },
    { name: 'PDF (.pdf)', value: 'pdf' },
    { name: 'Code file', value: 'code' },
];

// Ordered so more specific languages are checked before ones they'd otherwise collide with
// (e.g. "typescript" before "javascript", "c++" before generic "c").
const CODE_LANG_PATTERNS = [
    ['ts', /\btypescript\b/i],
    ['tsx', /\btsx\b/i],
    ['py', /\bpython\b|\.py\b/i],
    ['js', /\bjavascript\b|\bnode\.?js\b|\bjs\b/i],
    ['jsx', /\bjsx\b|\breact\b/i],
    ['java', /\bjava\b(?!script)/i],
    ['cpp', /\bc\+\+\b|\bcpp\b/i],
    ['cs', /\bc#\b|\bcsharp\b/i],
    ['go', /\bgolang\b|\bgo\b/i],
    ['rs', /\brust\b/i],
    ['rb', /\bruby\b/i],
    ['php', /\bphp\b/i],
    ['sh', /\bbash\b|\bshell\b|\.sh\b/i],
    ['sql', /\bsql\b/i],
    ['html', /\bhtml\b/i],
    ['css', /\bcss\b/i],
    ['c', /\bc\b(?! \+\+)/i],
];

function guessCodeExtension(description) {
    for (const [ext, pattern] of CODE_LANG_PATTERNS) {
        if (pattern.test(description)) return ext;
    }
    return 'txt';
}

function guessExtensionAndLabel(format, description) {
    switch (format) {
        case 'md': return { ext: 'md', label: 'Markdown file' };
        case 'docx': return { ext: 'docx', label: 'Word document' };
        case 'pdf': return { ext: 'pdf', label: 'PDF' };
        case 'code': {
            const ext = guessCodeExtension(description);
            return { ext, label: 'code file' };
        }
        case 'txt':
        default:
            return { ext: 'txt', label: 'text file' };
    }
}

function buildSystemPrompt(format) {
    const base = 'You generate the final content of a file the user is requesting. '
        + 'Respond with ONLY the raw file content — no chat commentary, no greetings, '
        + 'no explanations before or after, and no "Here is..." preamble.';

    if (format === 'code') {
        return `${base} Since this is a code file, do not wrap the code in markdown code fences (no triple backticks) — output only the raw source code.`;
    }
    if (format === 'md') {
        return `${base} Markdown formatting (headings, lists, bold, etc.) is fine since the output is a Markdown file, but do not wrap the whole thing in a code fence.`;
    }
    return `${base} Do not use markdown code fences. Plain formatted text only.`;
}

/** Build a real, paragraph-structured .docx buffer from AI text (split on blank lines). */
async function buildDocxBuffer(text) {
    const paragraphs = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    const children = (paragraphs.length ? paragraphs : [text]).flatMap((block) => {
        const lines = block.split('\n');
        return lines.map((line, i) =>
            new Paragraph({
                children: [new TextRun(line)],
                spacing: i === lines.length - 1 ? { after: 200 } : undefined,
            })
        );
    });

    const doc = new Document({
        sections: [{ properties: {}, children }],
    });
    return Packer.toBuffer(doc);
}

/** Render AI text as a real, word-wrapped, paginated PDF. */
function buildPdfBuffer(text) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.font('Helvetica').fontSize(11);
        const paragraphs = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
        for (const paragraph of paragraphs.length ? paragraphs : [text]) {
            doc.text(paragraph, { align: 'left' });
            doc.moveDown();
        }
        doc.end();
    });
}

async function buildAttachment({ format, description, rawText }) {
    const { ext, label } = guessExtensionAndLabel(format, description);
    const baseName = 'file';

    if (format === 'docx') {
        const buffer = await buildDocxBuffer(rawText);
        return { buffer, filename: `${baseName}.${ext}`, label };
    }
    if (format === 'pdf') {
        const buffer = await buildPdfBuffer(rawText);
        return { buffer, filename: `${baseName}.${ext}`, label };
    }
    // txt / md / code: send the raw text as-is
    const buffer = Buffer.from(rawText, 'utf8');
    return { buffer, filename: `${baseName}.${ext}`, label };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createfile')
        .setDescription('Generate a file with AI from a description (letter, script, README, etc.)')
        .addStringOption((o) =>
            o.setName('description').setDescription('Describe what the file should contain').setRequired(true))
        .addStringOption((o) =>
            o.setName('format').setDescription('Output file format').setRequired(false).addChoices(...FORMAT_CHOICES)),

    // Exported for testing without going through Discord.
    _internal: { buildDocxBuffer, buildPdfBuffer, buildAttachment, guessCodeExtension, guessExtensionAndLabel, buildSystemPrompt },

    async execute(interaction) {
        await interaction.deferReply();
        const description = interaction.options.getString('description');
        const format = interaction.options.getString('format') || 'txt';

        try {
            const { text } = await ai.chat(interaction.user.id, [{ role: 'user', content: description }], {
                systemPrompt: buildSystemPrompt(format),
            });

            const rawText = (text || '').trim();
            if (!rawText) {
                return interaction.editReply('The AI returned an empty response. Try rephrasing your description.');
            }
            if (Buffer.byteLength(rawText, 'utf8') > MAX_ATTACHMENT_BYTES) {
                return interaction.editReply('The generated content is too large to send as a Discord attachment. Try asking for something shorter.');
            }

            const { buffer, filename, label } = await buildAttachment({ format, description, rawText });
            if (buffer.length > MAX_ATTACHMENT_BYTES) {
                return interaction.editReply('The generated file is too large to send as a Discord attachment (10MB limit). Try asking for something shorter.');
            }

            const attachment = new AttachmentBuilder(buffer, { name: filename });
            await interaction.editReply({ content: `Here's your ${label}:`, files: [attachment] });
        } catch (error) {
            if (error instanceof ai.NoActiveKeyError) {
                return interaction.editReply('You need to configure an AI API key first — run `/aiconfig setkey` with your Gemini, OpenAI, or Claude key.');
            }
            console.error('createfile command error:', error);
            const providerMessage = error.response?.data?.error?.message
                || error.response?.data?.error?.[0]?.message
                || error.message;
            const safeMessage = typeof providerMessage === 'string' && providerMessage.length < 500
                ? providerMessage
                : 'an unknown error occurred';
            await interaction.editReply(`Couldn't generate that file: ${safeMessage}. Double-check your API key with \`/aiconfig status\`.`);
        }
    },
};
