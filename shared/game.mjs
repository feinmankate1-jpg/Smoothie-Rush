export const DURATION = 180;
export const SPEED = 5.2;
export const BOUNDS = { minX: -12.6, maxX: 12.6, minZ: -2.7, maxZ: 8.5 };
export const OBSTACLES = [
  { x: -12.95, z: 0, w: 1.5, d: 5.8 },
  { x: -9, z: 3.2, w: 4.1, d: 2.2 },
  { x: 4.9, z: 1.7, w: 2.2, d: 4.6 },
  { x: 10, z: 2.7, w: 2.2, d: 4.6 },
  { x: -3.5, z: -1.4, w: 3.7, d: 1.3 },
];
export const INGREDIENTS = {
  berries: {
    name: "Organic berries",
    short: "Berries",
    color: "#a74367",
    station: "fruit",
  },
  banana: {
    name: "Fresh banana",
    short: "Banana",
    color: "#d8c15c",
    station: "fruit",
  },
  greens: {
    name: "Organic greens",
    short: "Greens",
    color: "#6e8851",
    station: "greens",
  },
  matcha: {
    name: "Ceremonial matcha",
    short: "Matcha",
    color: "#7b965a",
    station: "greens",
  },
  almond: {
    name: "Almond milk",
    short: "Almond milk",
    color: "#d6c4a7",
    station: "milk",
  },
  coconut: {
    name: "Coconut water",
    short: "Coconut water",
    color: "#b6caca",
    station: "milk",
  },
};
export const RECIPES = {
  berry: {
    name: "Strawberry Cloud",
    subtitle: "A little pink perfection.",
    ingredients: ["berries", "banana", "almond"],
    color: "#d99aa9",
    accent: "#b85573",
    points: 100,
  },
  green: {
    name: "Green Glow",
    subtitle: "Your daily dose of good.",
    ingredients: ["greens", "banana", "coconut"],
    color: "#a8bb82",
    accent: "#6b824b",
    points: 110,
  },
  matcha: {
    name: "Matcha Ritual",
    subtitle: "Calm, cool, collected.",
    ingredients: ["matcha", "banana", "almond"],
    color: "#b6ba91",
    accent: "#788456",
    points: 120,
  },
};
export const STATIONS = [
  {
    id: "fruit",
    name: "Organic fruit",
    x: -10,
    z: -2.45,
    ingredients: ["berries", "banana"],
  },
  {
    id: "greens",
    name: "Greens & matcha",
    x: -6,
    z: -2.45,
    ingredients: ["greens", "matcha"],
  },
  {
    id: "milk",
    name: "Plant-based milks",
    x: -2,
    z: -2.45,
    ingredients: ["almond", "coconut"],
  },
  { id: "blender", name: "The blend bar", x: 2, z: -2.45 },
  { id: "serve", name: "Order pickup", x: -3.5, z: 0.1 },
];
export const OUTFITS = ["#304c3d", "#b89473", "#373b49", "#9a6261"];
export function canWalk(x, z, radius = 0.35) {
  return (
    x >= BOUNDS.minX &&
    x <= BOUNDS.maxX &&
    z >= BOUNDS.minZ &&
    z <= BOUNDS.maxZ &&
    !OBSTACLES.some(
      (o) =>
        Math.abs(x - o.x) < o.w / 2 + radius &&
        Math.abs(z - o.z) < o.d / 2 + radius,
    )
  );
}
export function walk(player, dx, dz, dt) {
  const len = Math.hypot(dx, dz);
  if (!len) return;
  const scale = (SPEED * dt) / Math.max(1, len);
  if (canWalk(player.x + dx * scale, player.z)) player.x += dx * scale;
  if (canWalk(player.x, player.z + dz * scale)) player.z += dz * scale;
  player.angle = Math.atan2(dx, dz);
}
export function nearestStation(player) {
  return STATIONS.map((s) => ({
    ...s,
    distance: Math.hypot(player.x - s.x, player.z - s.z),
  })).sort((a, b) => a.distance - b.distance)[0];
}
export function recipeFor(bag) {
  return Object.keys(RECIPES).find(
    (id) =>
      [...bag].sort().join(",") ===
      [...RECIPES[id].ingredients].sort().join(","),
  );
}
