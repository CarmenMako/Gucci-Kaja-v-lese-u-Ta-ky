
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const WORLD_LIMIT = 48;
const MAX_BLOCKS = 12000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "Gucci Kaja" });
});

const players = new Map();
const blocks = new Map();

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function validPosition(x, y, z) {
  return Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    Math.abs(x) <= WORLD_LIMIT &&
    Math.abs(z) <= WORLD_LIMIT &&
    y >= 0 &&
    y <= 80;
}

// Základní terén
for (let x = -12; x <= 12; x++) {
  for (let z = -12; z <= 12; z++) {
    blocks.set(blockKey(x, 0, z), {
      x, y: 0, z, type: "grass"
    });

    blocks.set(blockKey(x, -1, z), {
      x, y: -1, z, type: "dirt"
    });
  }
}

// Malé dekorativní ostrůvky
for (let i = 0; i < 35; i++) {
  const x = Math.floor(Math.random() * 65) - 32;
  const z = Math.floor(Math.random() * 65) - 32;

  if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;

  blocks.set(blockKey(x, 0, z), {
    x, y: 0, z, type: "grass"
  });
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    z: player.z,
    rotation: player.rotation,
    color: player.color
  };
}

io.on("connection", (socket) => {
  socket.emit("world:init", {
    blocks: Array.from(blocks.values()),
    players: Array.from(players.values()).map(publicPlayer)
  });

  socket.on("player:join", (data = {}) => {
    const name = String(data.name || "Hráč")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 18) || "Hráč";

    const player = {
      id: socket.id,
      name,
      x: Math.random() * 4 - 2,
      y: 2,
      z: Math.random() * 4 - 2,
      rotation: 0,
      color: Math.floor(Math.random() * 0xffffff)
    };

    players.set(socket.id, player);
    socket.emit("player:joined", publicPlayer(player));
    socket.broadcast.emit("player:created", publicPlayer(player));
    io.emit("players:count", players.size);
  });

  socket.on("player:move", (data = {}) => {
    const player = players.get(socket.id);
    if (!player) return;

    const x = Number(data.x);
    const y = Number(data.y);
    const z = Number(data.z);
    const rotation = Number(data.rotation);

    if (![x, y, z, rotation].every(Number.isFinite)) return;
    if (Math.abs(x) > WORLD_LIMIT + 5 ||
        Math.abs(z) > WORLD_LIMIT + 5 ||
        y < -2 || y > 100) return;

    player.x = x;
    player.y = y;
    player.z = z;
    player.rotation = rotation;

    socket.broadcast.volatile.emit(
      "player:moved",
      publicPlayer(player)
    );
  });

  socket.on("block:place", (data = {}) => {
    const x = Number(data.x);
    const y = Number(data.y);
    const z = Number(data.z);
    const allowed = ["grass", "dirt", "stone", "gold", "pink"];

    if (!validPosition(x, y, z)) return;
    if (!allowed.includes(data.type)) return;

    const key = blockKey(x, y, z);
    if (blocks.has(key) || blocks.size >= MAX_BLOCKS) return;

    const block = { x, y, z, type: data.type };
    blocks.set(key, block);
    io.emit("block:placed", block);
  });

  socket.on("block:break", (data = {}) => {
    const x = Number(data.x);
    const y = Number(data.y);
    const z = Number(data.z);

    if (!validPosition(x, y, z) || y <= 0) return;

    const key = blockKey(x, y, z);
    if (!blocks.has(key)) return;

    blocks.delete(key);
    io.emit("block:broken", { x, y, z });
  });

  socket.on("chat:send", (data = {}) => {
    const player = players.get(socket.id);
    if (!player) return;

    const message = String(data.message || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 180);

    if (!message) return;

    io.emit("chat:message", {
      name: player.name,
      message,
      time: Date.now()
    });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("player:left", socket.id);
    io.emit("players:count", players.size);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gucci Kaja běží na portu ${PORT}`);
});
