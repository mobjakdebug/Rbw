const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const errorHandler = require('./handlers/errorHandler');
const { checkAndRemoveBans } = require('./events/jobs/unbanJob');
const server = require('./server');
const { initializeDatabase, initDatabase } = require('./database');

// Add process error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    errorHandler.logError(error, { context: 'Uncaught Exception' });
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    errorHandler.logError(error, { context: 'Unhandled Rejection' });
});

require("dotenv").config();

// Check for required environment variables
const requiredEnvVars = ['TOKEN', 'API_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('Error: Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

const { Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember, Channel } = Partials;

const { loadEvents } = require("./handlers/eventHandler");
const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent, GuildVoiceStates],
  partials: [User, Message, GuildMember, ThreadMember],
});

client.commands = new Collection();

setInterval(() => {
  checkAndRemoveBans(client);
}, 15000);

async function initializeBot() {
  try {
        console.log('Starting bot initialization...');
        
        // Initialize database first
        console.log('Initializing database...');
        await initializeDatabase();
        await initDatabase();
        
        // Initialize error handler
        console.log('Initializing error handler...');
        await errorHandler.initializeLogFile();
        
        // Login to Discord
        console.log('Logging in to Discord...');
        await client.login(process.env.TOKEN);
        
        // Load events and commands
        console.log('Loading events...');
    await loadEvents(client);
        
        console.log('Loading commands...');
    await loadCommands(client);
        
        console.log('Bot initialization complete!');
  } catch (error) {
    console.error('Failed to initialize bot:', error);
    errorHandler.logError(error, { context: 'Bot Initialization' });
    process.exit(1);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Start the bot
console.log('Starting bot...');
initializeBot().catch(error => {
    console.error('Fatal error during initialization:', error);
    process.exit(1);
});