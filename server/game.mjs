import { randomInt } from "node:crypto";
import {
  DURATION,
  INGREDIENTS,
  RECIPES,
  OUTFITS,
  nearestStation,
  recipeFor,
  walk,
} from "../shared/game.mjs";

const NAMES = [
  "Sofia",
  "Miles",
  "Emma",
  "Theo",
  "Jules",
  "Olivia",
  "Alex",
  "Kai",
  "Harper",
  "Noah",
];
export function createRoom(code, host, mode = "friends") {
  return {
    code,
    host,
    mode,
    phase: "lobby",
    endsAt: null,
    remaining: DURATION,
    players: {},
    stock: Object.fromEntries(Object.keys(INGREDIENTS).map((k) => [k, 12])),
    orders: [],
    lastRestock: 0,
    sequence: 0,
    lastActive: Date.now(),
    events: [],
    lastSpawn: 0,
  };
}
export function addPlayer(room, id, profile = {}) {
  room.players[id] = {
    id,
    name: cleanName(profile.name),
    outfit: OUTFITS.includes(profile.outfit)
      ? profile.outfit
      : OUTFITS[Object.keys(room.players).length % OUTFITS.length],
    x: Object.keys(room.players).length ? 0.5 : -2,
    z: 5.5,
    angle: Math.PI,
    score: 0,
    served: 0,
    bag: [],
    drink: null,
    blendingUntil: null,
    input: { dx: 0, dz: 0, at: 0 },
  };
}
export function cleanName(name) {
  return (
    String(name || "You")
      .replace(/[<>\x00-\x1f]/g, "")
      .trim()
      .slice(0, 20) || "Employee"
  );
}
function newOrder(room, now) {
  const recipe = Object.keys(RECIPES)[room.sequence % 3];
  room.orders.push({
    id: `${room.code}-${++room.sequence}`,
    recipe,
    customer: NAMES[(room.sequence - 1) % NAMES.length],
    expiresAt: now + 75000,
    createdAt: now,
  });
  room.lastSpawn = now;
}
export function startRound(room, now = Date.now()) {
  room.phase = "playing";
  room.endsAt = now + DURATION * 1000;
  room.remaining = DURATION;
  room.orders = [];
  room.sequence = 0;
  room.stock = Object.fromEntries(Object.keys(INGREDIENTS).map((k) => [k, 12]));
  room.lastRestock = now;
  for (const player of Object.values(room.players))
    Object.assign(player, {
      score: 0,
      served: 0,
      bag: [],
      drink: null,
      blendingUntil: null,
    });
  for (let i = 0; i < 3; i++) newOrder(room, now);
}
export function tickRoom(room, now, dt) {
  for (const p of Object.values(room.players)) {
    if (!p.blendingUntil && now - p.input.at < 250)
      walk(p, p.input.dx, p.input.dz, dt);
    if (p.blendingUntil && p.blendingUntil <= now) {
      p.drink = recipeFor(p.bag);
      p.bag = [];
      p.blendingUntil = null;
    }
  }
  if (room.phase !== "playing") return;
  room.remaining = Math.max(0, Math.ceil((room.endsAt - now) / 1000));
  if (room.remaining === 0) {
    room.phase = "finished";
    return;
  }
  room.orders = room.orders.filter((o) => o.expiresAt > now);
  if (room.orders.length < 3 && now - room.lastSpawn > 1800)
    newOrder(room, now);
  if (now - room.lastRestock > 25000) {
    for (const key of Object.keys(room.stock))
      room.stock[key] = Math.min(12, room.stock[key] + 3);
    room.lastRestock = now;
  }
}
export function action(room, id, kind, ingredient, now = Date.now()) {
  const p = room.players[id];
  if (room.endsAt && now >= room.endsAt) {
    room.phase = "finished";
    room.remaining = 0;
  }
  if (!p || room.phase !== "playing")
    return { ok: false, message: "Start your shift to make smoothies." };
  if (p.blendingUntil)
    return { ok: false, message: "Your smoothie is blending." };
  if (kind === "clear") {
    for (const k of p.bag) room.stock[k] = Math.min(12, room.stock[k] + 1);
    p.bag = [];
    p.drink = null;
    return { ok: true, message: "Tray cleared. A fresh start." };
  }
  const station = nearestStation(p);
  if (!station || station.distance > 2.35)
    return { ok: false, message: "Walk closer to a station first." };
  if (kind === "collect") {
    if (!station.ingredients?.includes(ingredient))
      return { ok: false, message: "That ingredient is at another station." };
    if (p.drink) return { ok: false, message: "Deliver your smoothie first." };
    if (p.bag.length >= 3)
      return { ok: false, message: "Your tray is full. Head to the blenders." };
    if (!room.stock[ingredient])
      return { ok: false, message: "This ingredient is restocking." };
    room.stock[ingredient]--;
    p.bag.push(ingredient);
    return {
      ok: true,
      message: `${INGREDIENTS[ingredient].short} added to your tray.`,
    };
  }
  if (kind === "blend") {
    if (station.id !== "blender")
      return { ok: false, message: "Head to the blend bar." };
    if (!recipeFor(p.bag))
      return {
        ok: false,
        message: "Use the three ingredients shown on an order.",
      };
    p.blendingUntil = now + 2800;
    return { ok: true, message: "Blending a little goodness…" };
  }
  if (kind === "serve") {
    if (station.id !== "serve")
      return { ok: false, message: "Head to order pickup." };
    const order = room.orders.find(
      (o) => o.recipe === p.drink && o.expiresAt > now,
    );
    if (!order)
      return {
        ok: false,
        message: p.drink
          ? "No customer is waiting for that smoothie. Save it for the next order."
          : "Blend a smoothie before serving.",
      };
    const points = RECIPES[order.recipe].points;
    p.score += points;
    p.served++;
    p.drink = null;
    room.orders = room.orders.filter((o) => o.id !== order.id);
    return {
      ok: true,
      message: `${order.customer} loved it. +${points} points!`,
      served: {
        player: p.name,
        recipe: order.recipe,
        customer: order.customer,
        points,
      },
    };
  }
  return { ok: false, message: "Choose an ingredient or station action." };
}
export function serialize(room) {
  return {
    code: room.code,
    host: room.host,
    mode: room.mode,
    phase: room.phase,
    remaining: room.remaining,
    endsAt: room.endsAt,
    now: Date.now(),
    stock: room.stock,
    orders: room.orders,
    players: Object.fromEntries(
      Object.entries(room.players).map(([id, { input, ...p }]) => [id, p]),
    ),
  };
}
export function roomCode(existing) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from(
      { length: 5 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
  } while (existing.has(code));
  return code;
}
