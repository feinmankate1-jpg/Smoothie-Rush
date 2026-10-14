import test from "node:test";
import assert from "node:assert/strict";
import {
  action,
  addPlayer,
  createRoom,
  serialize,
  startRound,
  tickRoom,
} from "../server/game.mjs";
import { canWalk, recipeFor, walk, STATIONS } from "../shared/game.mjs";

function fixture() {
  const room = createRoom("TESTS", "a");
  addPlayer(room, "a", { name: "Avery" });
  addPlayer(room, "b", { name: "Riley" });
  startRound(room, 1000000);
  return room;
}
function at(p, station) {
  const s = STATIONS.find((s) => s.id === station);
  p.x = s.x;
  p.z = s.z;
}
function prepare(room, id) {
  const p = room.players[id];
  at(p, "fruit");
  assert.equal(action(room, id, "collect", "berries", 1000100).ok, true);
  assert.equal(action(room, id, "collect", "banana", 1000100).ok, true);
  at(p, "milk");
  assert.equal(action(room, id, "collect", "almond", 1000100).ok, true);
  at(p, "blender");
  assert.equal(action(room, id, "blend", null, 1000200).ok, true);
}
test("collision prevents walking through market fixtures and boundaries", () => {
  assert.equal(canWalk(4.9, 1.7), false);
  assert.equal(canWalk(-9, 3.2), false);
  assert.equal(canWalk(-12.4, 0), false);
  assert.equal(canWalk(20, 0), false);
  const p = { x: 3.35, z: 1.7 };
  walk(p, 1, 0, 0.1);
  assert.equal(p.x, 3.35);
  const diagonal = { x: 0, z: 4 };
  walk(diagonal, 1, 1, 0.1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z - 4) - 0.52) < 0.001);
});
test("two players share stock, blend recipes, and compete for a single order", () => {
  const room = fixture();
  prepare(room, "a");
  prepare(room, "b");
  assert.equal(room.stock.berries, 10);
  assert.equal(room.stock.almond, 10);
  tickRoom(room, 1003100, 0.05);
  assert.equal(room.players.a.drink, "berry");
  assert.equal(room.players.b.drink, "berry");
  at(room.players.a, "serve");
  at(room.players.b, "serve");
  assert.equal(action(room, "a", "serve", null, 1003200).ok, true);
  assert.equal(action(room, "b", "serve", null, 1003200).ok, false);
  assert.equal(room.players.a.score, 100);
  assert.equal(room.players.a.served, 1);
  assert.equal(room.players.b.score, 0);
  assert.equal(room.orders.length, 2);
  assert.ok(!serialize(room).players.a.input);
});
test("interactions require proximity, valid ingredients, and an active shift", () => {
  const room = fixture();
  assert.equal(action(room, "a", "collect", "berries", 1000100).ok, false);
  at(room.players.a, "fruit");
  assert.equal(action(room, "a", "collect", "almond", 1000100).ok, false);
  room.players.a.bag = ["berries", "berries", "banana"];
  at(room.players.a, "blender");
  assert.equal(action(room, "a", "blend", null, 1000100).ok, false);
  assert.equal(recipeFor(["almond", "banana", "berries"]), "berry");
  assert.equal(recipeFor(["almond", "berries"]), undefined);
  room.phase = "lobby";
  assert.equal(action(room, "a", "collect", "berries", 1000100).ok, false);
});
test("stock is finite, clearing a tray returns stock, and shared supplies restock", () => {
  const room = fixture();
  const p = room.players.a;
  at(p, "fruit");
  room.stock.berries = 1;
  assert.equal(action(room, "a", "collect", "berries", 1000100).ok, true);
  assert.equal(action(room, "a", "collect", "berries", 1000100).ok, false);
  action(room, "a", "clear", null, 1000200);
  assert.equal(room.stock.berries, 1);
  assert.equal(p.bag.length, 0);
  tickRoom(room, 1026000, 0.05);
  assert.equal(room.stock.berries, 4);
});
test("three-minute timer ends precisely and expired customers cannot be served", () => {
  const room = fixture();
  const p = room.players.a;
  at(p, "serve");
  p.drink = "berry";
  assert.equal(action(room, "a", "serve", null, 1076000).ok, false);
  tickRoom(room, 1179000, 0.05);
  assert.equal(room.remaining, 1);
  assert.equal(room.phase, "playing");
  assert.equal(action(room, "a", "serve", null, 1180000).ok, false);
  assert.equal(room.phase, "finished");
  assert.equal(p.score, 0);
  startRound(room, 1200000);
  assert.equal(room.remaining, 180);
  assert.equal(p.drink, null);
});
