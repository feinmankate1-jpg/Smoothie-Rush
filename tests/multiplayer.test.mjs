import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
import { once } from "node:events";

function request(socket, event, data = {}) {
  return new Promise((resolve, reject) =>
    socket
      .timeout(4000)
      .emit(event, data, (err, result) =>
        err ? reject(err) : resolve(result),
      ),
  );
}
function waitForState(socket, predicate) {
  if (socket.lastState && predicate(socket.lastState))
    return Promise.resolve(socket.lastState);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("state", handler);
      reject(new Error("Timed out waiting for synchronized game state"));
    }, 5000);
    function handler(state) {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off("state", handler);
        resolve(state);
      }
    }
    socket.on("state", handler);
  });
}
test(
  "live rooms, movement, rounds, capacity, host transfer and session recovery",
  { timeout: 30000 },
  async (t) => {
    const child = spawn(process.execPath, ["server/index.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, PORT: "0", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(async () => {
      child.kill("SIGTERM");
      if (child.exitCode === null) await once(child, "exit");
    });
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("Server did not start")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.once("error", reject);
    });
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await (await fetch(`${base}/api/health`)).json()).ok, true);
    function connect(auth) {
      const socket = io(base, {
        transports: ["websocket"],
        forceNew: true,
        auth,
      });
      socket.on("state", (state) => {
        socket.lastState = state;
      });
      t.after(() => socket.disconnect());
      return socket;
    }
    const a = connect(),
      b = connect(),
      c = connect();
    await Promise.all([
      waitForState(a, (s) => !!s.players[a.id]),
      waitForState(b, (s) => !!s.players[b.id]),
      waitForState(c, (s) => !!s.players[c.id]),
    ]);
    const created = await request(a, "create-room", {
      name: "Avery",
      outfit: "#304c3d",
    });
    assert.equal(created.ok, true);
    assert.match(created.code, /^[A-Z2-9]{5}$/);
    assert.equal(
      (
        await request(b, "join-room", {
          code: created.code,
          name: "Riley",
          outfit: "#9a6261",
        })
      ).ok,
      true,
    );
    await Promise.all([
      waitForState(a, (s) => Object.keys(s.players).length === 2),
      waitForState(b, (s) => Object.keys(s.players).length === 2),
    ]);
    assert.equal(
      (await request(c, "join-room", { code: created.code })).ok,
      false,
    );
    assert.equal((await request(c, "join-room", { code: "XXXXX" })).ok, false);
    assert.equal((await request(b, "start")).ok, false);
    assert.equal((await request(a, "start")).ok, true);
    const initial = await waitForState(b, (s) => s.phase === "playing");
    assert.equal(initial.remaining, 180);
    assert.equal(initial.orders.length, 3);
    assert.equal(initial.players[a.id].name, "Avery");
    assert.equal((await request(a, "start")).ok, false);
    const originalX = initial.players[a.id].x;
    a.emit("move", { dx: 1, dz: 0 });
    const moved = await waitForState(
      b,
      (s) => s.players[a.id].x > originalX + 0.4,
    );
    assert.ok(moved.players[a.id].x > originalX);
    assert.equal(moved.code, created.code);
    assert.equal(
      (await request(a, "action", { kind: "collect", ingredient: "berries" }))
        .ok,
      false,
    );
    const aid = a.id;
    a.disconnect();
    const afterDisconnect = await waitForState(
      b,
      (s) => !s.players[aid] && s.host === b.id,
    );
    assert.equal(Object.keys(afterDisconnect.players).length, 1);
    assert.equal(
      (
        await request(c, "join-room", {
          code: created.code,
          name: "New friend",
        })
      ).ok,
      true,
    );
    const joined = await waitForState(
      b,
      (s) => Object.keys(s.players).length === 2,
    );
    assert.equal(joined.phase, "playing");
    c.disconnect();
    await waitForState(b, (s) => Object.keys(s.players).length === 1);
    const key = "c".repeat(32),
      recovering = connect({ sessionKey: key });
    await waitForState(recovering, (s) => !!s.players[key]);
    assert.equal(
      (
        await request(recovering, "join-room", {
          code: created.code,
          name: "Returning friend",
        })
      ).ok,
      true,
    );
    recovering.emit("move", { dx: -1, dz: 0 });
    await waitForState(recovering, (s) => s.players[key]?.x < 0);
    const movement = setInterval(
      () => recovering.emit("move", { dx: 0, dz: -1 }),
      50,
    );
    await waitForState(recovering, (s) => s.players[key]?.z < -2.1);
    clearInterval(movement);
    recovering.emit("move", { dx: 0, dz: 0 });
    assert.equal(
      (
        await request(recovering, "action", {
          kind: "collect",
          ingredient: "almond",
        })
      ).ok,
      true,
    );
    const beforeDrop = await waitForState(recovering, (s) =>
      s.players[key]?.bag.includes("almond"),
    );
    recovering.io.reconnection(false);
    recovering.io.engine.close();
    await waitForState(b, (s) => s.players[key]?.online === false);
    const restored = connect({ sessionKey: key });
    const restoredState = await waitForState(
      restored,
      (s) => s.code === created.code && s.players[key]?.online === true,
    );
    assert.deepEqual(restoredState.players[key].bag, ["almond"]);
    assert.equal(restoredState.endsAt, beforeDrop.endsAt);
    assert.equal(restoredState.stock.almond, 11);
    assert.equal(restoredState.players[key].name, "Returning friend");
    assert.ok(
      Math.abs(restoredState.players[key].z - beforeDrop.players[key].z) < 0.3,
    );
    assert.equal((await request(restored, "action", null)).ok, false);
  },
);
