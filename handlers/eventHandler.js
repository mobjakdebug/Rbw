const { Table } = require('console-table-printer');
const fs = require('fs');
const path = require('path');

function loadEvents(client, gameLogger) {
    const table = new Table({
        columns: [
            { name: 'Events', alignment: 'left' },
            { name: 'Status', alignment: 'left' }
        ]
    });
    const eventsPath = path.join(__dirname, '..', 'events');

    function loadEvent(filePath) {
        const event = require(filePath);
        if (event.rest) {
            if (event.once)
                client.rest.once(event.name, (...args) => event.execute(...args, client, gameLogger));
            else
                client.rest.on(event.name, (...args) => event.execute(...args, client, gameLogger));
        } else {
            if (event.once)
                client.once(event.name, (...args) => event.execute(...args, client, gameLogger));
            else
                client.on(event.name, (...args) => event.execute(...args, client, gameLogger));
        }
        table.addRow({ Events: path.basename(filePath), Status: '✅' });
    }

    const eventFiles = fs.readdirSync(eventsPath);
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            const files = fs.readdirSync(filePath).filter((f) => f.endsWith(".js"));
            for (const nestedFile of files) {
                loadEvent(path.join(filePath, nestedFile));
            }
        } else if (file.endsWith('.js')) {
            loadEvent(filePath);
        }
    }

    table.printTable();
    console.log("\nLoaded events");
}

module.exports = { loadEvents };