const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const phatnguoi = require('../../utils/phatnguoiClient');

const VEHICLE_TYPE_LABELS = {
    oto: 'Ô tô',
    xemay: 'Xe máy',
    'xedap-dien': 'Xe đạp điện',
};

const MAX_VIOLATIONS_SHOWN = 10;

function buildNoViolationsEmbed(plate, vehicleTypeLabel) {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Tra cứu phạt nguội')
        .setDescription(`Biển số **${plate}** (${vehicleTypeLabel})\n\nKhông tìm thấy vi phạm nào. ✅`)
        .setFooter({ text: 'Dữ liệu chỉ mang tính tham khảo, vui lòng đối chiếu với nguồn chính thức.' })
        .setTimestamp();
}

function buildViolationsEmbed(plate, vehicleTypeLabel, violations) {
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Tra cứu phạt nguội')
        .setDescription(`Biển số **${plate}** (${vehicleTypeLabel})\n\nTìm thấy **${violations.length}** vi phạm:`)
        .setFooter({ text: 'Dữ liệu chỉ mang tính tham khảo, vui lòng đối chiếu với nguồn chính thức.' })
        .setTimestamp();

    const shown = violations.slice(0, MAX_VIOLATIONS_SHOWN);
    for (const [index, violation] of shown.entries()) {
        const date = violation.date || 'Không rõ';
        const location = violation.location || 'Không rõ';
        const description = violation.description || 'Không rõ';
        const status = violation.status || 'Không rõ';
        embed.addFields({
            name: `#${index + 1} — ${date}`,
            value: `**Địa điểm:** ${location}\n**Lỗi vi phạm:** ${description}\n**Trạng thái:** ${status}`,
        });
    }

    if (violations.length > MAX_VIOLATIONS_SHOWN) {
        embed.addFields({
            name: '​',
            value: `...và ${violations.length - MAX_VIOLATIONS_SHOWN} vi phạm khác không được hiển thị.`,
        });
    }

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('phatnguoi')
        .setDescription('Tra cứu phạt nguội (vi phạm giao thông qua camera) theo biển số xe')
        .addStringOption((o) =>
            o.setName('bienso').setDescription('Biển số xe, vd: 30A-12345 hoặc 30A12345').setRequired(true))
        .addStringOption((o) =>
            o.setName('loaixe').setDescription('Loại phương tiện').setRequired(false)
                .addChoices(
                    { name: 'Ô tô', value: 'oto' },
                    { name: 'Xe máy', value: 'xemay' },
                    { name: 'Xe đạp điện', value: 'xedap-dien' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const rawPlate = interaction.options.getString('bienso');
        const vehicleType = interaction.options.getString('loaixe') || 'oto';
        const vehicleTypeLabel = VEHICLE_TYPE_LABELS[vehicleType] || vehicleType;

        const plate = phatnguoi.normalizePlate(rawPlate);
        if (!plate) {
            return interaction.editReply(
                `Biển số \`${rawPlate}\` không đúng định dạng. Vui lòng nhập theo dạng biển số Việt Nam, ví dụ: \`30A-12345\` hoặc \`30A12345\`.`
            );
        }

        try {
            const { violations } = await phatnguoi.lookupViolations({ plate, vehicleType });
            const embed = violations.length
                ? buildViolationsEmbed(plate, vehicleTypeLabel, violations)
                : buildNoViolationsEmbed(plate, vehicleTypeLabel);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            if (error instanceof phatnguoi.PhatNguoiNotConfiguredError) {
                return interaction.editReply(
                    'Tính năng tra cứu phạt nguội chưa được cấu hình trên bot này.\n\n' +
                    'Cổng tra cứu chính thức (csgt.vn) yêu cầu giải mã CAPTCHA thủ công nên bot không thể tự động ' +
                    'truy vấn, và hiện chưa có API công khai chính thức nào cho việc này. Xem file `PHATNGUOI_SETUP.md` ' +
                    'ở gốc dự án để biết các lựa chọn và cách cấu hình `PHATNGUOI_API_BASE_URL` (và `PHATNGUOI_API_KEY` nếu cần).'
                );
            }
            if (error instanceof phatnguoi.PhatNguoiServiceError) {
                console.error('phatnguoi command service error:', error);
                return interaction.editReply(
                    `Không thể tra cứu lúc này (${error.message}). Vui lòng thử lại sau ít phút.`
                );
            }
            console.error('phatnguoi command error:', error);
            await interaction.editReply('Đã xảy ra lỗi không mong muốn khi tra cứu phạt nguội. Vui lòng thử lại sau.');
        }
    },
};
