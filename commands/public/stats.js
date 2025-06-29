const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { query } = require("../../database");
const config = require('../../config.json');
const path = require('path');

let Canvas;
try {
    Canvas = require('canvas');
} catch (error) {
    console.warn('Canvas module not available, will use text-based stats instead');
}

async function createStatsCanvas(stats, mcUsername) {
    if (!Canvas) {
        throw new Error('Canvas module not available');
    }

    const canvas = Canvas.createCanvas(1000, 500);
    const ctx = canvas.getContext('2d');

    // Load and draw background image
    const background = await Canvas.loadImage(path.join(__dirname, '../../Assets/Images/StatsBG.png'));
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // Add blur effect
    ctx.filter = 'blur(5px)';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    // Username
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(mcUsername, canvas.width / 2, 80);

    // ELO and Rank container
    drawContainer(ctx, 50, 120, 400, 200);
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('ELO', 250, 170);
    ctx.font = 'bold 72px Arial';
    ctx.fillText(stats.elo.toString(), 250, 250);
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Rank: ${stats.rank}`, 250, 290);

    // Other stats container
    drawContainer(ctx, 550, 120, 400, 350);
    const otherStats = [
        { label: 'Wins', value: stats.wins },
        { label: 'Losses', value: stats.lost },
        { label: 'W/L Ratio', value: stats.wlr.toFixed(2) },
        { label: 'Total Games', value: stats.games },
        { label: 'MVP Count', value: stats.mvp }
    ];

    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    let y = 170;
    otherStats.forEach(stat => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(stat.label, 580, y);
        ctx.fillStyle = '#7289DA';
        ctx.fillText(stat.value.toString(), 850, y);
        y += 60;
    });

    return canvas.toBuffer();
}

function drawContainer(ctx, x, y, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 20);
    ctx.fill();
}

function createStatsEmbed(stats, mcUsername) {
    return new EmbedBuilder()
        .setTitle(`${mcUsername}'s Stats`)
        .setColor(config.ThemeColor)
        .addFields(
            { name: 'ELO', value: stats.elo.toString(), inline: true },
            { name: 'Rank', value: stats.rank, inline: true },
            { name: 'Wins', value: stats.wins.toString(), inline: true },
            { name: 'Losses', value: stats.lost.toString(), inline: true },
            { name: 'W/L Ratio', value: stats.wlr.toFixed(2), inline: true },
            { name: 'Total Games', value: stats.games.toString(), inline: true },
            { name: 'MVP Count', value: stats.mvp.toString(), inline: true }
        )
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("View your stats")
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('The player whose stats you want to view')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Get the target user (either mentioned user or command user)
            const targetUser = interaction.options.getUser('player') || interaction.user;

            const userInfo = await query('registered', 'findOne', { discord_id: targetUser.id });
            if (!userInfo) {
                return await interaction.editReply(
                    targetUser.id === interaction.user.id 
                        ? 'You are not registered. Please use the register command first.'
                        : `${targetUser.username} is not registered.`
                );
            }

            const stats = await query('stats', 'findOne', { discord_id: targetUser.id });
            if (!stats) {
                return await interaction.editReply(
                    targetUser.id === interaction.user.id
                        ? 'Stats not found. Please contact an administrator.'
                        : `Stats not found for ${targetUser.username}. Please contact an administrator.`
                );
            }

            try {
            const statsImage = await createStatsCanvas(stats, userInfo.mc_user);
            const attachment = new AttachmentBuilder(statsImage, { name: 'stats.png' });
            await interaction.editReply({ files: [attachment] });
            } catch (canvasError) {
                console.warn('Canvas error, falling back to embed:', canvasError);
                const embed = createStatsEmbed(stats, userInfo.mc_user);
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in stats command:', error);
            await interaction.editReply('An error occurred while fetching the stats.');
        }
    },
};