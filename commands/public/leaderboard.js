const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { query } = require('../../database');
const path = require('path');
const fs = require('fs');

let Canvas;
try {
    Canvas = require('@napi-rs/canvas');
} catch (error) {
    console.warn('Canvas module not available, will use text-based leaderboard instead');
}

function createLeaderboardEmbed(rows, page, itemsPerPage, title, valueKey, formatValue, statLabel) {
    const totalPages = Math.ceil(rows.length / itemsPerPage);
    const pageRows = rows.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    
    const embed = new EmbedBuilder()
        .setTitle(`${title} - Page ${page + 1}/${totalPages}`)
        .setColor('#7289DA')
        .setTimestamp();

    let description = '';
    pageRows.forEach((entry, index) => {
        const globalRank = page * itemsPerPage + index + 1;
        description += `**${globalRank}.** ${entry.mc_user} - ${formatValue(entry[valueKey])} ${statLabel}\n`;
    });

    embed.setDescription(description);
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View various leaderboards')
        .addSubcommand(subcommand => 
            subcommand
                .setName('elo')
                .setDescription('Top players by Elo rating'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('bedbreak')
                .setDescription('Top bed breakers'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('wins')
                .setDescription('Top players by wins'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('lost')
                .setDescription('Top players by lost games'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('wlr')
                .setDescription('Top players by Win/Loss Ratio')),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        
        let queryString, title, valueKey, formatValue, statLabel;
        switch (subcommand) {
            case 'elo':
                queryString = `
                    SELECT 
                        r.mc_user, 
                        r.discord_id, 
                        COALESCE(s.elo, 0) as elo
                    FROM 
                        registered r
                    LEFT JOIN 
                        stats s ON r.discord_id = s.discord_id
                    ORDER BY 
                        elo DESC
                `;
                title = 'Elo Leaderboard';
                valueKey = 'elo';
                formatValue = (val) => Math.round(val).toLocaleString();
                statLabel = 'Elo Rating';
                break;
            case 'bedbreak':
                queryString = `
                    SELECT 
                        r.mc_user, 
                        r.discord_id, 
                        COALESCE(s.bed_breaker, 0) as bed_breaker
                    FROM 
                        registered r
                    LEFT JOIN 
                        stats s ON r.discord_id = s.discord_id
                    ORDER BY 
                        bed_breaker DESC
                `;
                title = 'Bed Breakers Leaderboard';
                valueKey = 'bed_breaker';
                formatValue = (val) => Math.round(val).toLocaleString();
                statLabel = 'Bed Breaks';
                break;
            case 'wins':
                queryString = `
                    SELECT 
                        r.mc_user, 
                        r.discord_id, 
                        COALESCE(s.wins, 0) as wins
                    FROM 
                        registered r
                    LEFT JOIN 
                        stats s ON r.discord_id = s.discord_id
                    ORDER BY 
                        wins DESC
                `;
                title = 'Wins Leaderboard';
                valueKey = 'wins';
                formatValue = (val) => Math.round(val).toLocaleString();
                statLabel = 'Total Wins';
                break;
            case 'lost':
                queryString = `
                    SELECT 
                        r.mc_user, 
                        r.discord_id, 
                        COALESCE(s.lost, 0) as lost
                    FROM 
                        registered r
                    LEFT JOIN 
                        stats s ON r.discord_id = s.discord_id
                    ORDER BY 
                        lost DESC
                `;
                title = 'Lost Games Leaderboard';
                valueKey = 'lost';
                formatValue = (val) => Math.round(val).toLocaleString();
                statLabel = 'Total Losses';
                break;
            case 'wlr':
                queryString = `
                    SELECT 
                        r.mc_user, 
                        r.discord_id, 
                        COALESCE(s.wlr, 0) as wlr
                    FROM 
                        registered r
                    LEFT JOIN 
                        stats s ON r.discord_id = s.discord_id
                    ORDER BY 
                        wlr DESC
                `;
                title = 'Win/Loss Ratio Leaderboard';
                valueKey = 'wlr';
                formatValue = (val) => val.toFixed(2);
                statLabel = 'W/L Ratio';
                break;
            default:
                return interaction.editReply('Invalid leaderboard type');
        }

        try {
            const rows = await query('registered', 'select', queryString);
            const itemsPerPage = 5;
            const totalPages = Math.ceil(rows.length / itemsPerPage);

            async function createLeaderboardImage(page) {
                if (!Canvas) {
                    throw new Error('Canvas module not available');
                }

                const backgroundPath = path.resolve(__dirname, '../../Assets/Images/StatsBG.png');
                
                if (!fs.existsSync(backgroundPath)) {
                    throw new Error('Background image not found');
                }

                const background = await Canvas.loadImage(backgroundPath);
                const canvas = Canvas.createCanvas(1000, Math.min(1000, itemsPerPage * 100 + 200));
                const ctx = canvas.getContext('2d');

                ctx.filter = 'blur(50px)';
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';

                ctx.fillStyle = '#FFFFFF';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${title} - Page ${page + 1}/${totalPages}`, canvas.width / 2, 70);

                ctx.font = '30px Arial';
                ctx.fillStyle = '#7289DA';
                ctx.textAlign = 'left';
                ctx.fillText('Rank', 50, 130);
                ctx.fillText('Username', 200, 130);
                ctx.textAlign = 'right';
                ctx.fillText(statLabel, canvas.width - 50, 130);

                ctx.beginPath();
                ctx.strokeStyle = '#7289DA';
                ctx.lineWidth = 2;
                ctx.moveTo(25, 150);
                ctx.lineTo(canvas.width - 25, 150);
                ctx.stroke();

                const pageRows = rows.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

                pageRows.forEach((entry, index) => {
                    const y = 200 + index * 100;
                    const globalRank = page * itemsPerPage + index + 1;
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '25px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${globalRank}`, 50, y);

                    ctx.fillText(entry.mc_user, 200, y);

                    ctx.textAlign = 'right';
                    ctx.fillText(formatValue(entry[valueKey]), canvas.width - 50, y);

                    ctx.beginPath();
                    ctx.strokeStyle = '#484C52';
                    ctx.lineWidth = 1;
                    ctx.moveTo(25, y + 20);
                    ctx.lineTo(canvas.width - 25, y + 20);
                    ctx.stroke();
                });

                return canvas.toBuffer('image/png');
            }

            const createButtons = (page) => {
                const row = new ActionRowBuilder();
                
                if (page > 0) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_prev_${subcommand}`)
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                if (page < totalPages - 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leaderboard_next_${subcommand}`)
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                return row;
            };

            let currentPage = 0;
            let message;

            try {
                const initialImage = await createLeaderboardImage(currentPage);
            if (totalPages > 1) {
                const initialButtons = createButtons(currentPage);
                message = await interaction.editReply({ 
                    files: [new AttachmentBuilder(initialImage, { name: 'leaderboard.png' })],
                    components: [initialButtons]
                });
            } else {
                message = await interaction.editReply({ 
                    files: [new AttachmentBuilder(initialImage, { name: 'leaderboard.png' })]
                });
                }
            } catch (canvasError) {
                console.warn('Canvas error, falling back to embed:', canvasError);
                const embed = createLeaderboardEmbed(rows, currentPage, itemsPerPage, title, valueKey, formatValue, statLabel);
                if (totalPages > 1) {
                    const initialButtons = createButtons(currentPage);
                    message = await interaction.editReply({ 
                        embeds: [embed],
                        components: [initialButtons]
                    });
                } else {
                    message = await interaction.editReply({ 
                        embeds: [embed]
                    });
                }
            }

            const collector = message.createMessageComponentCollector({ 
                time: 5 * 60 * 1000
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ 
                        content: 'You cannot control this leaderboard.', 
                        ephemeral: true 
                    });
                    return;
                }

                if (i.customId.startsWith('leaderboard_prev_')) {
                    currentPage--;
                } else if (i.customId.startsWith('leaderboard_next_')) {
                    currentPage++;
                }

                try {
                const newImage = await createLeaderboardImage(currentPage);
                    const newButtons = createButtons(currentPage);
                    await i.update({ 
                        files: [new AttachmentBuilder(newImage, { name: 'leaderboard.png' })],
                        components: [newButtons]
                    });
                } catch (canvasError) {
                    console.warn('Canvas error in pagination, falling back to embed:', canvasError);
                    const embed = createLeaderboardEmbed(rows, currentPage, itemsPerPage, title, valueKey, formatValue, statLabel);
                    const newButtons = createButtons(currentPage);
                    await i.update({ 
                        embeds: [embed],
                        components: [newButtons]
                    });
                }
            });

            collector.on('end', () => {
                if (message.components.length > 0) {
                    message.edit({ components: [] }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            await interaction.editReply('An error occurred while fetching the leaderboard.');
        }
    },
};