const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            await client.user.setPresence({
            activities: [{ 
                    name: 'RankedBedwars', 
                type: ActivityType.Playing 
            }],
                status: 'online'
        });
       
            console.log(`Bot is ready! Logged in as ${client.user.tag}`);
        } catch (error) {
            console.error('Error in ready event:', error);
        }
    }
}