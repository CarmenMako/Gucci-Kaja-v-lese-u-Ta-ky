const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    game: 'Gucci Kaja',
    version: '2.0.0'
  });
});

const players = new Map();

const colors = [
  '#ff72bd',
  '#65c8ff',
  '#b99aff',
  '#ffbd66',
  '#6fe0a1',
  '#ff8e7b',
  '#ffe36e'
];

function cleanNick(value) {
  const nick = String(value || 'Dobrodruh')
    .replace(/[<>\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 16);

  return nick || 'Dobrodruh';
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value)
    ? Math.max(-48, Math.min(48, value))
    : fallback;
}

io.on('connection', socket => {
  socket.emit('worldState', {
    players: [...players.entries()].map(([id, p]) => ({
      id,
      ...p
    }))
  });

  socket.on('joinGame', (data = {}) => {
    const player = {
      nick: cleanNick(data.nick),
      color: colors[Math.floor(Math.random() * colors.length)],
      x: safeNumber(data.x, Math.random() * 4 - 2),
      y: 0,
      z: safeNumber(data.z, Math.random() * 4 - 2),
      yaw: 0,
      emote: 'idle'
    };

    players.set(socket.id, player);

    socket.emit('joined', {
      id: socket.id,
      player
    });

    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      player
    });

    io.emit('playerCount', players.size);
  });

  socket.on('move', data => {
    const p = players.get(socket.id);

    if (
      !p ||
      !data ||
      !Number.isFinite(data.x) ||
      !Number.isFinite(data.z)
    ) {
      return;
    }

    p.x = safeNumber(data.x);
    p.z = safeNumber(data.z);
    p.yaw = Number.isFinite(data.yaw) ? data.yaw : 0;
    p.emote = typeof data.emote === 'string'
      ? data.emote.slice(0, 12)
      : 'idle';

    socket.broadcast.volatile.emit('playerMoved', {
      id: socket.id,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      emote: p.emote
    });
  });

  socket.on('chatMessage', message => {
    const p = players.get(socket.id);

    if (!p) return;

    const text = String(message || '')
      .replace(/[<>\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 120);

    if (text) {
      io.emit('chatMessage', {
        nick: p.nick,
        text,
        id: socket.id,
        at: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('playerLeft', socket.id);
    io.emit('playerCount', players.size);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gucci Kaja 2.0 běží na portu ${PORT}`);
});
