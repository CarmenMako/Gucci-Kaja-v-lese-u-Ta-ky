const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

let players = {};
let barricades = [];

io.on('connection', (socket) => {
    console.log('Hráč připojen:', socket.id);

    players[socket.id] = {
        id: socket.id,
        x: 0, y: 0, z: 0,
        rotation: 0,
        name: "Hráч"
    };

    socket.emit('currentPlayers', players);
    socket.emit('currentBarricades', barricades);

    socket.on('joinGame', (name) => {
        if (players[socket.id]) {
            players[socket.id].name = name || "Káji parťák";
            socket.broadcast.emit('newPlayer', players[socket.id]);
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotation = movementData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('placeBarricade', (barricadeData) => {
        barricades.push(barricadeData);
        io.emit('barricadePlaced', barricadeData);
    });

    socket.on('playerShoot', (shootData) => {
        socket.broadcast.emit('otherPlayerShot', shootData);
    });

    socket.on('disconnect', () => {
        console.log('Hráč odpojen:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
});
