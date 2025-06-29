const { Table } = require('console-table-printer');
    const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
    try {
        console.log('Starting to load commands...');
        const table = new Table({
            columns: [
                { name: 'Commands', alignment: 'left' },
                { name: 'Status', alignment: 'left' }
            ]
        });
    let commandsArray = [];

        const commandsFolder = path.join(__dirname, '..', 'commands');
        if (!fs.existsSync(commandsFolder)) {
            console.log('Commands folder not found, creating it...');
            fs.mkdirSync(commandsFolder, { recursive: true });
            return console.log('No commands found. Commands folder created.');
        }

        const commandFolders = fs.readdirSync(commandsFolder);
        if (commandFolders.length === 0) {
            return console.log('No command folders found.');
        }

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsFolder, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;

            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            if (commandFiles.length === 0) continue;

            console.log(`Loading commands from ${folder}...`);
        for (const file of commandFiles) {
                try {
                    const filePath = path.join(folderPath, file);
                    const commandFile = require(filePath);

                    if (!commandFile.data || !commandFile.data.name) {
                        console.warn(`Command file ${file} is missing required data`);
                        continue;
                    }

            client.commands.set(commandFile.data.name, commandFile);
            commandsArray.push(commandFile.data.toJSON());
                    table.addRow({ Commands: file, Status: '✅' });
                } catch (error) {
                    console.error(`Error loading command ${file}:`, error);
                    table.addRow({ Commands: file, Status: '❌' });
                }
            }
        }

        if (commandsArray.length > 0) {
            console.log('Registering commands with Discord...');
            await client.application.commands.set(commandsArray);
            table.printTable();
            console.log("\nLoaded Commands");
        } else {
            console.log('No commands were loaded.');
        }
    } catch (error) {
        console.error('Error in loadCommands:', error);
        throw error;
    }
}

module.exports = { loadCommands };