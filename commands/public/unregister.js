const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { query } = require("../../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister yourself"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.user;

    try {
      const existingUser = await query('registered', 'findOne', { discord_id: user.id });

      if (!existingUser) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('Unregistration Failed')
          .setDescription(`You are not registered.`);

        return interaction.editReply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      // Create confirmation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_unregister')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_unregister')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      const warningEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('Unregistration Warning')
        .setDescription(`Are you sure you want to unregister? This action cannot be undone.`);

      const response = await interaction.editReply({
        embeds: [warningEmbed],
        components: [row],
        ephemeral: true,
      });

      // Create button collector
      const collector = response.createMessageComponentCollector({ 
        filter: i => i.user.id === user.id,
        time: 30000,
        max: 1 
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'confirm_unregister') {
          await query('registered', 'deleteOne', { discord_id: user.id });
          await query('stats', 'deleteOne', { discord_id: user.id });

          const member = await interaction.guild.members.fetch(user.id);
          try {
            if (member.guild.members.me.permissions.has('ManageNicknames') &&
                member.manageable) {
              await member.setNickname(null);
            }
          } catch (error) {
            console.error("Failed to reset nickname:", error);
          }

          const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Unregistration Successful')
            .setDescription(`You have been successfully unregistered.`);

          await i.update({
            embeds: [successEmbed],
            components: [],
          });
        } else {
          const cancelEmbed = new EmbedBuilder()
            .setColor('#0000FF')
            .setTitle('Unregistration Cancelled')
            .setDescription(`Your unregistration has been cancelled.`);

          await i.update({
            embeds: [cancelEmbed],
            components: [],
          });
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle('Unregistration Timed Out')
            .setDescription(`You didn't respond in time. The unregistration process has been cancelled.`);

          interaction.editReply({
            embeds: [timeoutEmbed],
            components: [],
          });
        }
      });

    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Error')
        .setDescription("An error occurred while processing the command.");

      return interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};