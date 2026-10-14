import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  action,
  addPlayer,
  cleanName,
  createRoom,
  roomCode,
  serialize,
  startRound,
  tickRoom,
} from "./game.mjs";
import { OUTFITS } from "../shared/game.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 16384 });
const rooms = new Map();
const sessions = new Map();
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
app.get("/api/health", (_, res) =>
  res.json({ ok: true, game: "Smoothie Rush" }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((_, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { server: http } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
function emit(room) {
  io.to(room.code).emit("state", serialize(room));
}
function leave(socket) {
  const room = rooms.get(socket.data.room);
  if (!room) return;
  const id = socket.data.playerId;
  const session = sessions.get(id);
  clearTimeout(session?.cleanup);
  sessions.delete(id);
  delete room.players[id];
  socket.leave(room.code);
  if (room.host === id)
    room.host =
      Object.values(room.players).find((p) => p.online)?.id ||
      Object.keys(room.players)[0] ||
      null;
  if (!Object.keys(room.players).length) rooms.delete(room.code);
  else emit(room);
  socket.data.room = null;
}
function enter(socket, room, profile) {
  socket.data.room = room.code;
  socket.join(room.code);
  addPlayer(room, socket.data.playerId, profile);
  room.players[socket.data.playerId].online = true;
  sessions.set(socket.data.playerId, { room: room.code, socketId: socket.id });
  emit(room);
}
io.on("connection", (socket) => {
  const requested = socket.handshake.auth?.sessionKey;
  let id =
    typeof requested === "string" && /^[a-f0-9]{32}$/.test(requested)
      ? requested
      : socket.id;
  if (
    sessions.get(id)?.socketId &&
    io.sockets.sockets.has(sessions.get(id).socketId)
  )
    id = randomBytes(16).toString("hex");
  socket.data.playerId = id;
  const session = sessions.get(id),
    previousRoom = rooms.get(session?.room);
  socket.emit("welcome", {
    playerId: id,
    resumed: !!previousRoom?.players[id],
  });
  if (previousRoom?.players[id]) {
    clearTimeout(session.cleanup);
    sessions.set(id, { room: previousRoom.code, socketId: socket.id });
    socket.data.room = previousRoom.code;
    socket.join(previousRoom.code);
    previousRoom.players[id].online = true;
    emit(previousRoom);
  } else {
    const code = roomCode(rooms);
    const room = createRoom(code, id, "practice");
    rooms.set(code, room);
    enter(socket, room, {});
  }
  socket.on("create-room", (profile = {}, ack) => {
    profile = object(profile);
    const code = roomCode(rooms);
    leave(socket);
    const room = createRoom(code, id);
    rooms.set(code, room);
    enter(socket, room, profile);
    ack?.({ ok: true, code });
  });
  socket.on("join-room", (data = {}, ack) => {
    data = object(data);
    const code = String(data.code || "")
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room || room.mode === "practice")
      return ack?.({
        ok: false,
        message: "We couldn’t find that room. Check the code and try again.",
      });
    if (socket.data.room === code) return ack?.({ ok: true, code });
    if (Object.keys(room.players).length >= 2)
      return ack?.({
        ok: false,
        message: "This shift already has two employees.",
      });
    leave(socket);
    enter(socket, room, data);
    ack?.({ ok: true, code });
  });
  socket.on("profile", (data = {}) => {
    data = object(data);
    const room = rooms.get(socket.data.room);
    const p = room?.players[id];
    if (!p) return;
    p.name = cleanName(data.name);
    if (OUTFITS.includes(data.outfit)) p.outfit = data.outfit;
    emit(room);
  });
  socket.on("move", (input = {}) => {
    input = object(input);
    const p = rooms.get(socket.data.room)?.players[id];
    if (p)
      p.input = {
        dx: Number.isFinite(input.dx) ? Math.max(-1, Math.min(1, input.dx)) : 0,
        dz: Number.isFinite(input.dz) ? Math.max(-1, Math.min(1, input.dz)) : 0,
        at: Date.now(),
      };
  });
  socket.on("start", (_, ack) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.host !== id)
      return ack?.({ ok: false, message: "Your host will start the shift." });
    if (room.phase === "playing")
      return ack?.({ ok: false, message: "The shift is already running." });
    startRound(room);
    emit(room);
    ack?.({ ok: true });
  });
  socket.on("action", (data = {}, ack) => {
    data = object(data);
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const result = action(room, id, data.kind, data.ingredient);
    ack?.(result);
    if (result.served) io.to(room.code).emit("served", result.served);
    emit(room);
  });
  socket.on("disconnect", (reason) => {
    if (
      reason === "client namespace disconnect" ||
      reason === "server namespace disconnect"
    )
      return leave(socket);
    const room = rooms.get(socket.data.room),
      session = sessions.get(id);
    if (!room?.players[id] || session?.socketId !== socket.id) return;
    room.players[id].online = false;
    room.players[id].input = { dx: 0, dz: 0, at: 0 };
    session.socketId = null;
    if (room.host === id)
      room.host = Object.values(room.players).find((p) => p.online)?.id || id;
    session.cleanup = setTimeout(() => leave(socket), 120000);
    session.cleanup.unref();
    emit(room);
  });
});
let lastTick = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;
  for (const room of rooms.values()) {
    tickRoom(room, now, dt);
    emit(room);
  }
}, 50);
const port = Number(process.env.PORT || 5173);
http.listen(port, "0.0.0.0", () =>
  console.log(`Smoothie Rush listening on port ${http.address().port}`),
);
function shutdown() {
  clearInterval(timer);
  io.close();
  http.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
