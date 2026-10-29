const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const players = new Map();
const blocks = new Map();

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function cleanNick(value) {
  return String(value || "Hráč")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16) || "Hráč";
}

io.on("connection", (socket) => {
  socket.on("joinGame", (rawNick) => {
    const nick = cleanNick(rawNick);

    players.set(socket.id, {
      id: socket.id,
      nick,
      x: 0,
      y: 0,
      z: 5,
      rot: 0,
      color: Math.floor(Math.random() * 0xffffff)
    });

    socket.emit("worldState", {
      players: [...players.values()],
      blocks: [...blocks.values()]
    });

    socket.broadcast.emit("playerJoined", players.get(socket.id));
    socket.emit("joined", {
      id: socket.id,
      nick
    });
  });

  socket.on("move", (data) => {
    const player = players.get(socket.id);
    if (!player || !data) return;

    player.x = Math.max(-18, Math.min(18, Number(data.x) || 0));
    player.y = Math.max(0, Math.min(20, Number(data.y) || 0));
    player.z = Math.max(-18, Math.min(18, Number(data.z) || 0));
    player.rot = Number(data.rot) || 0;

    socket.broadcast.emit("playerMoved", player);
  });

  socket.on("placeBlock", (data) => {
    if (!players.has(socket.id) || !data) return;

    const x = Math.round(Number(data.x));
    const y = Math.round(Number(data.y));
    const z = Math.round(Number(data.z));
    const type = ["grass", "dirt", "stone", "wood", "pink"]
      .includes(data.type) ? data.type : "grass";

    if (![x, y, z].every(Number.isFinite)) return;
    if (Math.abs(x) > 60 || Math.abs(z) > 60 || y < 0 || y > 40) return;

    const key = blockKey(x, y, z);
    if (blocks.has(key) || blocks.size >= 2500) return;

    const block = { x, y, z, type };
    blocks.set(key, block);
    io.emit("blockPlaced", block);
  });

  socket.on("breakBlock", (data) => {
    if (!players.has(socket.id) || !data) return;

    const x = Math.round(Number(data.x));
    const y = Math.round(Number(data.y));
    const z = Math.round(Number(data.z));

    if (![x, y, z].every(Number.isFinite)) return;

    const key = blockKey(x, y, z);
    if (blocks.delete(key)) {
      io.emit("blockBroken", { x, y, z });
    }
  });

  socket.on("chatMessage", (raw) => {
    const player = players.get(socket.id);
    if (!player) return;

    const message = String(raw || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, 140);

    if (message) {
      io.emit("chatMessage", {
        nick: player.nick,
        message
      });
    }
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("playerLeft", socket.id);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gucci Kaja běží na portu ${PORT}`);
});
