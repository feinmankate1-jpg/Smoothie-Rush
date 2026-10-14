import { io } from "socket.io-client";
import { createStore } from "./store.js";
import {
  INGREDIENTS,
  RECIPES,
  OUTFITS,
  STATIONS,
  canWalk,
  nearestStation,
} from "../shared/game.mjs";
import { icon, drinkArt } from "./art.js";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/libre-caslon-display/400.css";
import "./style.css";

document.querySelector("#app").innerHTML = `
  <header class="site-header">
    <a class="brand" href="/" aria-label="Smoothie Rush home"><span class="brand-symbol">${icon("leaf")}</span><span class="brand-name">smoothie rush<span>MARKET & TONIC CO.</span></span></a>
    <nav class="top-nav" aria-label="Main navigation"><span class="nav-active">The market</span><button data-modal="help">How to play ${icon("arrowUp")}</button></nav>
    <div class="header-actions"><button class="icon-button sound-button" aria-label="Turn market sounds on">${icon("mute")}</button><button class="invite-button" data-modal="friends">${icon("users")} Play with a friend ${icon("arrowUp")}</button></div>
  </header>
  <main>
    <section class="page-intro"><div><div class="eyebrow"><span class="tiny-dot"></span> THE DAILY SHIFT <span class="eyebrow-rule"></span> LOS ANGELES, CA</div><h1>A little wellness. A little friendly competition.</h1><p>Fresh ingredients, familiar faces. Make yourself at home.</p></div><div class="shift-scoreboard"><div class="score-item"><span>YOUR SCORE</span><strong id="my-score">000</strong></div><div class="score-item friend-score"><span id="rival-label">FRIEND’S SCORE</span><strong id="rival-score">—</strong></div><div class="timer-block">${icon("clock")}<div><span>SHIFT REMAINING</span><strong id="timer">03:00</strong></div></div></div></section>
    <div class="game-layout">
      <section class="market-panel" aria-label="Interactive 3D grocery store">
        <div class="market-heading"><div class="market-title">${icon("leaf")} <strong>Market & Tonic</strong><span class="market-location">BEVERLY GROVE</span></div><div class="connection"><span class="status-dot"></span><span id="connection-label">Connecting…</span></div></div>
        <div class="store-stage"><canvas id="store" aria-label="Click inside the market to move your employee. Use W A S D or arrow keys to walk." tabindex="0"></canvas><div class="scene-note"><span>THE GOOD KIND OF RUSH.</span><p>Organic, always. Made by you.</p></div><button class="scene-help icon-button" data-modal="help" aria-label="Game instructions">${icon("help")}</button><div class="scene-tag">${icon("pin")} Los Angeles <span>·</span> A sunny kind of day</div><div id="shift-banner" class="shift-banner">Welcome to your neighborhood market.<span>Pick an order. Find your rhythm.</span></div><div id="toast" class="toast" role="status" aria-live="polite"></div><div class="station-dock" id="station-dock"></div></div>
        <div class="market-footer"><div class="movement-guide"><span class="key-set"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>to move</span><i></i><span>Click to walk</span><i></i><kbd>E</kbd><span>to interact</span></div><button class="outfit-button" data-modal="profile">${icon("shirt")} Your look ${icon("arrowUp")}</button></div>
      </section>
      <aside class="orders-panel"><div class="orders-heading"><div><span class="eyebrow">MADE WITH GOODNESS</span><h2>The order board <span id="order-count">3</span></h2></div><p id="order-description">A few favorites, ready for your touch.</p></div><div id="orders" class="orders-list"></div><div class="tray-section"><div class="tray-heading"><h3>${icon("basket")} Your tray</h3><button id="clear-tray" aria-label="Clear your tray">Clear</button></div><div id="tray" class="tray-slots"></div><p id="tray-hint">Good things start with fresh ingredients.</p></div><div class="shift-action"><button id="start-shift" class="primary-button">Start practice shift ${icon("arrow")}</button><p id="shift-caption"><span class="tiny-dot"></span> Playing solo? Find your rhythm first.</p></div></aside>
    </div>
    <footer class="page-footer"><span>CRAFTED WITH CARE. SERVED WITH A LITTLE HUSTLE.</span><span>3 minutes. Fresh blends. Bragging rights. ${icon("leaf")}</span></footer>
  </main>
  <div id="modal-layer" class="modal-layer" hidden></div>
`;
let sessionKey;
try {
  sessionKey = sessionStorage.getItem("smoothie-session");
} catch {}
if (!/^[a-f0-9]{32}$/.test(sessionKey || ""))
  sessionKey = [...crypto.getRandomValues(new Uint32Array(4))]
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
const socket = io({
  transports: ["websocket", "polling"],
  tryAllTransports: true,
  auth: { sessionKey },
});
let state,
  myId,
  selectedRecipe = "berry",
  selectedOrder,
  lastOrders = "",
  lastTray = "",
  lastDock = "",
  lastButton = "",
  lastCaption = "",
  toastTimer,
  connected = false,
  path = [],
  lastMove = 0,
  audioContext,
  sound = false,
  showResults = false;
let profile;
try {
  profile = JSON.parse(localStorage.getItem("smoothie-profile")) || {
    name: "You",
    outfit: OUTFITS[0],
  };
} catch {
  profile = { name: "You", outfit: OUTFITS[0] };
}
const keys = new Set();
const $ = (sel) => document.querySelector(sel);
const setText = (selector, value) => {
  const element = $(selector);
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let store;
try {
  store = createStore($("#store"), setDestination);
} catch (error) {
  console.error(error);
  $(".store-stage").insertAdjacentHTML(
    "beforeend",
    '<div class="render-error">Your browser needs WebGL to display the market. Enable hardware acceleration and reload.</div>',
  );
}
function toast(message, error = false) {
  $("#toast").textContent = message;
  $("#toast").classList.toggle("error", error);
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3600);
}
function beep(frequency = 550) {
  if (!sound) return;
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator(),
    gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 0.22,
  );
  osc.start();
  osc.stop(audioContext.currentTime + 0.23);
}
socket.on("connect", () => {
  myId = socket.auth.sessionKey;
  connected = true;
  socket.emit("profile", profile);
});
socket.on("welcome", ({ playerId, resumed }) => {
  myId = playerId;
  socket.auth.sessionKey = playerId;
  try {
    sessionStorage.setItem("smoothie-session", playerId);
  } catch {}
  if (resumed) toast("Welcome back. Your shift is right where you left it.");
});
socket.on("disconnect", () => {
  connected = false;
  $("#connection-label").textContent = "Reconnecting…";
  $(".status-dot").classList.add("offline");
  path = [];
  toast("Connection lost. Reconnecting to the market…", true);
});
socket.on("connect_error", () => {
  $("#connection-label").textContent = "Unable to connect";
  $(".status-dot").classList.add("offline");
});
socket.on("state", (next) => {
  const previous = state;
  state = next;
  if (!myId) myId = socket.auth.sessionKey;
  if (previous?.code !== state.code) {
    lastOrders = lastTray = lastDock = "";
    selectedOrder = null;
    showResults = false;
  }
  render();
  store?.updatePlayers(state, myId);
  if (
    state.phase === "finished" &&
    previous?.phase === "playing" &&
    !showResults
  ) {
    showResults = true;
    openModal("results");
  }
});
socket.on("served", (event) => {
  beep(780);
  toast(
    `${event.player} served ${event.customer} a ${RECIPES[event.recipe].name}. +${event.points}!`,
  );
});
function emitAction(kind, ingredient) {
  if (!connected)
    return toast("The market is reconnecting. Try again in a moment.", true);
  socket.emit("action", { kind, ingredient }, (result) => {
    toast(result.message, !result.ok);
    if (result.ok) beep();
  });
}
function render() {
  const me = state.players[myId];
  if (!me) return;
  const other = Object.values(state.players).find((p) => p.id !== myId);
  setText("#my-score", String(me.score).padStart(3, "0"));
  setText("#rival-score", other ? String(other.score).padStart(3, "0") : "—");
  setText(
    "#rival-label",
    other ? `${other.name.toUpperCase()}’S SCORE` : "FRIEND’S SCORE",
  );
  setText(
    "#timer",
    `${String(Math.floor(state.remaining / 60)).padStart(2, "0")}:${String(state.remaining % 60).padStart(2, "0")}`,
  );
  $(".timer-block").classList.toggle(
    "running-low",
    state.phase === "playing" && state.remaining < 30,
  );
  $(".status-dot").classList.toggle("offline", !connected);
  setText(
    "#connection-label",
    state.mode === "practice"
      ? "Practice mode"
      : `Room ${state.code} · ${Object.values(state.players).filter((p) => p.online !== false).length}/2 online`,
  );
  const orders =
    state.phase === "lobby"
      ? ["berry", "green", "matcha"].map((recipe, i) => ({
          id: `preview${i}`,
          recipe,
          customer: ["Sofia", "Miles", "Emma"][i],
        }))
      : state.orders;
  if (!orders.some((o) => o.id === selectedOrder))
    selectedOrder =
      orders.find((o) => o.recipe === selectedRecipe)?.id || orders[0]?.id;
  const selected = orders.find((o) => o.id === selectedOrder);
  if (selected) selectedRecipe = selected.recipe;
  const orderKey =
    JSON.stringify(orders.map((o) => [o.id, o.recipe, o.customer])) +
    selectedOrder +
    me.bag.join(",");
  if (lastOrders !== orderKey) {
    lastOrders = orderKey;
    $("#orders").innerHTML =
      orders
        .map((o, i) => {
          const r = RECIPES[o.recipe];
          return `<button class="order-card ${o.id === selectedOrder ? "selected" : ""}" data-order="${o.id}" aria-pressed="${o.id === selectedOrder}"><div class="order-card-top"><span class="customer-avatar avatar-${i}">${o.customer.charAt(0)}</span><span>${escape(o.customer)}’s order</span><span class="points">+${r.points} pts</span></div><div class="order-product">${drinkArt(r, `${o.recipe}${i}`)}<div class="order-product-info"><h3>${r.name}</h3><p>${r.subtitle}</p><div class="ingredient-tags">${r.ingredients.map((k) => `<span class="ingredient-tag ${me.bag.includes(k) ? "collected" : ""}"><i style="background:${INGREDIENTS[k].color}"></i>${INGREDIENTS[k].short}${me.bag.includes(k) ? icon("check") : ""}</span>`).join("")}</div></div></div><div class="order-card-bottom"><span>${o.id === selectedOrder ? `${icon("check")} YOUR NEXT BLEND` : "TAP TO FOLLOW THIS RECIPE"}</span><span class="patience-label" data-patience="${o.id}">${state.phase === "lobby" ? "Made to order" : "Patiently waiting"}</span></div>${state.phase === "playing" ? `<div class="patience-track"><div data-patience-bar="${o.id}"></div></div>` : ""}</button>`;
        })
        .join("") ||
      '<div class="empty-orders">All caught up.<br><span>Your next customer is on their way.</span></div>';
  }
  for (const o of orders) {
    if (o.expiresAt) {
      const remaining = Math.max(0, (o.expiresAt - state.now) / 1000);
      const bar = document.querySelector(`[data-patience-bar="${o.id}"]`);
      if (bar) {
        bar.style.width = `${(remaining / 75) * 100}%`;
        bar.classList.toggle("low", remaining < 20);
      }
      const label = document.querySelector(`[data-patience="${o.id}"]`);
      if (label) label.textContent = `${Math.ceil(remaining)}s waiting`;
    }
  }
  setText("#order-count", orders.length);
  setText(
    "#order-description",
    state.phase === "playing"
      ? state.mode === "practice"
        ? "Fresh orders. Happy customers. Find your flow."
        : "Same orders. Two baristas. First blend wins."
      : state.phase === "finished"
        ? "That’s a wrap. Beautifully blended."
        : "A few favorites, ready for your touch.",
  );
  const trayKey = JSON.stringify([me.bag, me.drink, !!me.blendingUntil]);
  if (lastTray !== trayKey) {
    lastTray = trayKey;
    $("#tray").innerHTML = me.drink
      ? `<div class="ready-drink">${icon("cup")}<div><strong>${RECIPES[me.drink].name}</strong><span>Ready for order pickup</span></div>${icon("check")}</div>`
      : [0, 1, 2]
          .map((i) => {
            const item = INGREDIENTS[me.bag[i]];
            return `<div class="tray-slot ${item ? "filled" : ""}">${item ? `<span class="ingredient-orb" style="--ingredient:${item.color}">${icon("leaf")}</span><span>${item.short}</span>` : `<span class="slot-plus">+</span><span>Ingredient ${i + 1}</span>`}</div>`;
          })
          .join("");
    $("#tray-hint").textContent = me.blendingUntil
      ? "A little goodness is blending…"
      : me.drink
        ? "Take your finished blend to station 05."
        : me.bag.length === 3
          ? "Tray full. Next stop: the blend bar, station 04."
          : "Collect the three ingredients in your recipe.";
  }
  $("#clear-tray").disabled =
    (!me.bag.length && !me.drink) || !!me.blendingUntil;
  const station = nearestStation(me);
  const close = station.distance <= 2.35;
  store?.highlightStation(close ? station.id : null);
  const needed = RECIPES[selectedRecipe]?.ingredients.find(
    (k) => !me.bag.includes(k),
  );
  let hint =
    state.phase === "lobby"
      ? "Your apron is on. Your shift is next."
      : me.drink
        ? "Head to order pickup to serve your smoothie."
        : me.bag.length === 3
          ? "Head to the blend bar. Time for a little magic."
          : `Pick up ${needed ? INGREDIENTS[needed].short.toLowerCase() : "your ingredients"} at the tonic bar.`;
  const dockKey = [
    state.phase,
    close ? station.id : "",
    me.bag.join(","),
    me.drink,
    !!me.blendingUntil,
    selectedRecipe,
    JSON.stringify(state.stock),
  ].join("|");
  if (lastDock !== dockKey) {
    lastDock = dockKey;
    let buttons = "";
    if (state.phase === "playing" && close && !me.blendingUntil) {
      if (station.ingredients && !me.drink)
        buttons = station.ingredients
          .map(
            (k, i) =>
              `<button data-collect="${k}" ${!state.stock[k] || me.bag.length >= 3 ? "disabled" : ""}><i style="background:${INGREDIENTS[k].color}"></i>${INGREDIENTS[k].short}<span>${state.stock[k]}</span><kbd>${i + 1}</kbd></button>`,
          )
          .join("");
      if (station.id === "blender")
        buttons = `<button data-action="blend">${icon("cup")} Blend smoothie <kbd>E</kbd></button>`;
      if (station.id === "serve")
        buttons = `<button data-action="serve">${icon("check")} Serve customer <kbd>E</kbd></button>`;
    }
    $("#station-dock").innerHTML =
      `<div class="dock-copy"><span class="dock-number">${close ? String(STATIONS.findIndex((s) => s.id === station.id) + 1).padStart(2, "0") : icon("leaf")}</span><div><strong>${me.blendingUntil ? "Blending your smoothie…" : close ? station.name : "A fresh start"}</strong><span>${buttons ? "Shared ingredients. Make every scoop count." : hint}</span></div></div>${buttons ? `<div class="dock-actions">${buttons}</div>` : state.phase === "lobby" ? `<button data-start class="dock-start" ${state.host !== myId ? "disabled" : ""}>${state.host === myId ? "Start your shift" : "Waiting for host"} ${icon("arrow")}</button>` : ""}`;
  }
  $("#shift-banner").hidden = state.phase === "playing";
  if (state.phase === "finished")
    $("#shift-banner").innerHTML =
      "That’s a wrap.<span>A little hustle. A lot of goodness.</span>";
  const start = $("#start-shift");
  const buttonKey = [
    state.phase,
    state.host === myId,
    state.mode,
    me.served,
  ].join("|");
  if (buttonKey !== lastButton) {
    lastButton = buttonKey;
    if (state.phase === "playing") {
      start.innerHTML = `${icon("cup")} ${me.served} ${me.served === 1 ? "smoothie" : "smoothies"} served`;
      start.disabled = true;
    } else {
      start.disabled = state.host !== myId;
      start.innerHTML = `${state.phase === "finished" ? "Another round?" : state.mode === "practice" ? "Start practice shift" : "Start the shift"} ${icon("arrow")}`;
    }
  }
  const caption =
    state.mode === "practice"
      ? '<span class="tiny-dot"></span> Playing solo? Find your rhythm first.'
      : state.host !== myId && state.phase !== "playing"
        ? '<span class="tiny-dot"></span> Your host will start the shift.'
        : `<span class="tiny-dot"></span> ${other ? (other.online === false ? `${escape(other.name)} is reconnecting…` : `${escape(other.name)} is here. Let’s blend.`) : "Invite a friend with your room code."}`;
  if (caption !== lastCaption) {
    lastCaption = caption;
    $("#shift-caption").innerHTML = caption;
  }
}
function start() {
  socket.emit("start", {}, (result) => {
    if (!result.ok) toast(result.message, true);
    else {
      showResults = false;
      toast("Your three-minute shift starts now. Let’s blend.");
      beep(660);
    }
  });
}
$("#start-shift").addEventListener("click", start);
$("#clear-tray").addEventListener("click", () => emitAction("clear"));
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-start]")) start();
  const order = e.target.closest("[data-order]");
  if (order) {
    selectedOrder = order.dataset.order;
    lastOrders = lastDock = "";
    render();
  }
  const collect = e.target.closest("[data-collect]");
  if (collect) emitAction("collect", collect.dataset.collect);
  const action = e.target.closest("[data-action]");
  if (action) emitAction(action.dataset.action);
  const modal = e.target.closest("[data-modal]");
  if (modal) openModal(modal.dataset.modal);
});
$(".sound-button").addEventListener("click", () => {
  sound = !sound;
  $(".sound-button").innerHTML = icon(sound ? "sound" : "mute");
  $(".sound-button").setAttribute(
    "aria-label",
    sound ? "Turn market sounds off" : "Turn market sounds on",
  );
  if (sound) {
    beep(440);
    toast("Market sounds on. A little music to your shift.");
  }
});
function interact(index = 0) {
  if (!state?.players[myId]) return;
  const station = nearestStation(state.players[myId]);
  if (station.distance > 2.35)
    return toast("Walk closer to a station to interact.");
  if (station.ingredients) {
    const needed = RECIPES[selectedRecipe].ingredients.find(
      (k) =>
        station.ingredients.includes(k) && !state.players[myId].bag.includes(k),
    );
    emitAction(
      "collect",
      index === -1
        ? needed || station.ingredients[0]
        : station.ingredients[index],
    );
  } else emitAction(station.id === "blender" ? "blend" : "serve");
}
document.addEventListener("keydown", (e) => {
  if (!$("#modal-layer").hidden) {
    if (e.key === "Escape") closeModal();
    return;
  }
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      "e",
      "1",
      "2",
      " ",
    ].includes(key)
  )
    e.preventDefault();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(key)
  ) {
    keys.add(key);
    path = [];
    store?.clearTarget();
  }
  if (!e.repeat && key === "e") interact(-1);
  if (!e.repeat && ["1", "2"].includes(key)) interact(Number(key) - 1);
});
document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  socket.emit("move", { dx: 0, dz: 0 });
});
// Grid routing keeps click-to-walk paths out of grocery fixtures.
function setDestination(x, z) {
  const me = state?.players[myId];
  if (!me) return;
  const step = 0.45,
    width = 57,
    height = 26;
  const grid = (px, pz) => [
    Math.max(0, Math.min(width - 1, Math.round((px + 12.6) / step))),
    Math.max(0, Math.min(height - 1, Math.round((pz + 2.7) / step))),
  ];
  const point = ([gx, gz]) => [-12.6 + gx * step, -2.7 + gz * step];
  let goal = grid(x, z);
  if (!canWalk(...point(goal), 0.42)) {
    const options = [];
    for (let gx = 0; gx < width; gx++)
      for (let gz = 0; gz < height; gz++) {
        const p = point([gx, gz]);
        if (canWalk(...p, 0.42))
          options.push({ grid: [gx, gz], d: Math.hypot(p[0] - x, p[1] - z) });
      }
    options.sort((a, b) => a.d - b.d);
    goal = options[0].grid;
  }
  const begin = grid(me.x, me.z),
    id = ([gx, gz]) => `${gx},${gz}`,
    visited = new Map([[id(begin), null]]),
    queue = [begin];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (id(current) === id(goal)) break;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = [current[0] + dx, current[1] + dz];
      const key = id(next);
      if (
        next[0] < 0 ||
        next[0] >= width ||
        next[1] < 0 ||
        next[1] >= height ||
        visited.has(key) ||
        !canWalk(...point(next), 0.42)
      )
        continue;
      visited.set(key, current);
      queue.push(next);
    }
  }
  if (!visited.has(id(goal))) return toast("Try a clear spot in the aisle.");
  path = [];
  let current = goal;
  while (current) {
    path.unshift(point(current));
    current = visited.get(id(current));
  }
  path.shift();
  $("#store").focus({ preventScroll: true });
}
setInterval(() => {
  if (!connected || !state?.players[myId]) return;
  const me = state.players[myId];
  let dx = 0,
    dz = 0;
  if (keys.has("w") || keys.has("arrowup")) {
    dx -= 0.63;
    dz -= 0.77;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    dx += 0.63;
    dz += 0.77;
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    dx -= 0.77;
    dz += 0.63;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    dx += 0.77;
    dz -= 0.63;
  }
  if (path.length && !dx && !dz) {
    while (
      path.length &&
      Math.hypot(path[0][0] - me.x, path[0][1] - me.z) < 0.26
    )
      path.shift();
    if (path.length) {
      dx = path[0][0] - me.x;
      dz = path[0][1] - me.z;
      const distance = Math.hypot(dx, dz);
      dx /= distance;
      dz /= distance;
    } else store?.clearTarget();
  }
  if (dx || dz || lastMove) socket.emit("move", { dx, dz });
  lastMove = dx || dz;
}, 50);
let modalReturnFocus;
function closeModal() {
  $("#modal-layer").hidden = true;
  modalReturnFocus?.focus();
}
function openModal(type) {
  keys.clear();
  path = [];
  socket.emit("move", { dx: 0, dz: 0 });
  modalReturnFocus = document.activeElement;
  const layer = $("#modal-layer");
  layer.hidden = false;
  let title, body;
  if (type === "help") {
    title = "A good shift starts here.";
    body = `<p class="modal-intro">Step into the market. Blend something beautiful. Serve it before your friend does.</p><div class="help-steps"><div><span>01</span><section><h3>Pick your goodness</h3><p>Select an order on the board. Walk to fruit, greens, and milks at stations 01–03. Collect the recipe’s three ingredients.</p></section></div><div><span>02</span><section><h3>Find your blend</h3><p>Take your full tray to station 04. Press E to blend. It takes a moment, so make it count.</p></section></div><div><span>03</span><section><h3>Serve a little joy</h3><p>Bring your smoothie to order pickup, station 05. Press E to serve a waiting customer and earn points.</p></section></div></div><div class="help-note">${icon("users")} Both employees share orders and ingredient stock. The first to serve wins the order. Stock refreshes every 25 seconds.</div><p class="help-controls"><kbd>W A S D</kbd> / arrows to move · Click to walk · <kbd>E</kbd> to interact<br><kbd>1</kbd> / <kbd>2</kbd> to choose ingredients · Clear to reset your tray</p><button class="primary-button" id="got-it">Make yourself at home ${icon("arrow")}</button>`;
  } else if (type === "profile") {
    title = "Your shift. Your style.";
    body = `<p class="modal-intro">A clean tee, your favorite apron, and a little main-character energy.</p>${profileFields()}<button class="primary-button" id="save-profile">Looking good ${icon("check")}</button>`;
  } else if (type === "results") {
    const players = Object.values(state.players).sort(
      (a, b) => b.score - a.score,
    );
    const tied = players.length === 2 && players[0].score === players[1].score;
    title =
      state.mode === "practice"
        ? "A beautiful first blend."
        : tied
          ? "A perfectly balanced match."
          : `${escape(players[0].name)} takes the shift.`;
    body = `<p class="modal-intro">Three minutes of hustle. Here’s the goodness you made.</p><div class="results-list">${players.map((p) => `<div><span class="result-avatar" style="background:${p.outfit}">${escape(p.name.charAt(0))}</span><section><h3>${escape(p.name)} ${p.id === myId ? "<small>YOU</small>" : ""}</h3><p>${p.served} smoothies served</p></section><strong>${p.score}<small>POINTS</small></strong></div>`).join("")}</div><button class="primary-button" id="play-again" ${state.host !== myId ? "disabled" : ""}>${state.host === myId ? "One more shift?" : "Waiting for your host"} ${icon("refresh")}</button><button class="secondary-button" id="back-market">Back to the market</button>`;
  } else {
    title = "Better with a friend.";
    body = `<p class="modal-intro">Same market. Shared ingredients. A little friendly competition.</p>${state?.mode === "friends" ? `<div class="room-share"><span>YOUR PRIVATE ROOM CODE</span><strong>${state.code}</strong><button class="secondary-button" id="copy-room">${icon("copy")} Copy invite link</button><p>${Object.keys(state.players).length === 2 ? "Your friend is here. Ready when you are." : "Share the code with a friend, then start your shift."}</p></div>` : `${profileFields()}<button class="primary-button" id="create-room">Create a private room ${icon("arrow")}</button>`}<div class="or-divider"><span>OR JOIN A FRIEND</span></div><form id="join-form"><label for="room-code">Room code</label><div class="join-row"><input id="room-code" name="code" placeholder="e.g. BLEND" maxlength="5" autocomplete="off" required pattern="[A-Za-z2-9]{5}" aria-describedby="join-error"/><button class="primary-button" type="submit">Join ${icon("arrow")}</button></div><p id="join-error" class="form-error" role="alert"></p></form>`;
  }
  layer.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close icon-button" aria-label="Close dialog">${icon("close")}</button><span class="eyebrow">SMOOTHIE RUSH · MARKET & TONIC</span><h2 id="modal-title">${title}</h2>${body}</div>`;
  layer.querySelector(".modal-close").addEventListener("click", closeModal);
  layer.onclick = (e) => {
    if (e.target === layer) closeModal();
  };
  layer.querySelector("#got-it")?.addEventListener("click", closeModal);
  layer.querySelectorAll("[data-outfit]").forEach((button) =>
    button.addEventListener("click", () => {
      layer
        .querySelectorAll("[data-outfit]")
        .forEach((b) => b.classList.remove("chosen"));
      button.classList.add("chosen");
      $(".employee-preview").style.setProperty(
        "--apron",
        button.dataset.outfit,
      );
    }),
  );
  layer.querySelector("#save-profile")?.addEventListener("click", () => {
    saveProfile();
    closeModal();
    toast("Fresh look. Ready for your shift.");
  });
  layer.querySelector("#create-room")?.addEventListener("click", () => {
    saveProfile();
    socket.emit("create-room", profile, (result) => {
      if (result.ok) {
        openModal("friends");
        toast("Your private market is open. Invite your friend.");
      }
    });
  });
  layer.querySelector("#join-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (layer.querySelector("#employee-name")) saveProfile();
    socket.emit(
      "join-room",
      { code: $("#room-code").value, ...profile },
      (result) => {
        if (result.ok) {
          closeModal();
          toast("You’re in. Let’s make a little goodness.");
        } else $("#join-error").textContent = result.message;
      },
    );
  });
  layer.querySelector("#copy-room")?.addEventListener("click", async () => {
    const url = new URL(location.href);
    url.searchParams.set("room", state.code);
    try {
      await navigator.clipboard.writeText(url.href);
      $("#copy-room").innerHTML = `${icon("check")} Invite link copied`;
    } catch {
      $("#copy-room").innerHTML = `Share code: ${state.code}`;
    }
  });
  layer.querySelector("#play-again")?.addEventListener("click", () => {
    closeModal();
    start();
  });
  layer.querySelector("#back-market")?.addEventListener("click", closeModal);
  const first = layer.querySelector("input, .primary-button, .modal-close");
  first?.focus();
}
function profileFields() {
  return `<div class="profile-editor"><div class="employee-preview" style="--apron:${profile.outfit}"><div class="employee-head"></div><div class="employee-body"><span>M&T</span></div></div><div class="profile-fields"><label for="employee-name">Your employee name</label><input id="employee-name" value="${escape(profile.name)}" maxlength="20" autocomplete="nickname"/><label>Your apron</label><div class="outfit-swatches">${OUTFITS.map((c, i) => `<button type="button" class="outfit-swatch ${profile.outfit === c ? "chosen" : ""}" data-outfit="${c}" style="--swatch:${c}" aria-label="${["Forest", "Oat", "Slate", "Rose"][i]} apron">${icon("check")}</button>`).join("")}</div></div></div>`;
}
function saveProfile() {
  profile = {
    name: $("#employee-name")?.value.trim() || profile.name || "Employee",
    outfit:
      document.querySelector("[data-outfit].chosen")?.dataset.outfit ||
      profile.outfit,
  };
  try {
    localStorage.setItem("smoothie-profile", JSON.stringify(profile));
  } catch {}
  socket.emit("profile", profile);
}
document.addEventListener("keydown", (e) => {
  const layer = $("#modal-layer");
  if (layer.hidden || e.key !== "Tab") return;
  const focusables = [
      ...layer.querySelectorAll("button:not(:disabled), input"),
    ],
    first = focusables[0],
    last = focusables.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
const inviteCode = new URLSearchParams(location.search).get("room");
if (inviteCode)
  socket.once("state", () => {
    openModal("friends");
    $("#room-code").value = inviteCode.toUpperCase().slice(0, 5);
  });
