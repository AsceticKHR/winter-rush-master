const WebSocket = require('ws');
const os = require('os');

const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0'});

let players = {};

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                const playerId = generatePlayerId();
                players[playerId] = { score: 0 };
                ws.send(JSON.stringify({ type: 'joined', playerId, players }));
                broadcast({ type: 'updatePlayers', players });
                break;

            case 'score':
                if (players[data.playerId]) {
                    players[data.playerId].score = data.value;
                    broadcast({ type: 'updatePlayers', players });
                }
                break;

            case 'disconnect':
                delete players[data.playerId];
                broadcast({ type: 'updatePlayers', players });
                break;
        }
    });

    ws.on('close', function() {
        // Handle player disconnection
    });
});

function generatePlayerId() {
    return 'player-' + Math.random().toString(36).substr(2, 9);
}

function broadcast(data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function getLocalExternalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const serverIP = getLocalExternalIP();
console.log(`Server is running on ws://${serverIP}:8080`);