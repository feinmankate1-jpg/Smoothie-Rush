export const icons = {
  leaf: '<path d="M20 4c-8-2-16 2-16 9a7 7 0 0 0 7 7c7 0 11-8 9-16Z"/><path d="M4 20 15 9M10 14v-4m4 0h4"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-3-5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  arrowUp: '<path d="M6 18 18 6M6 6h12v12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sound:
    '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 5 6m0-6-5 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-1 .5-1.2 1.3-1.2 2.3m0 3h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cup: '<path d="M6 6h12l-2 15H8L6 6Zm-2 0h16M13 6l3-5"/>',
  basket: '<path d="m3 9 3 11h12l3-11H3Zm4 0 5-7 5 7m-7 4v4m4-4v4"/>',
  pin: '<path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
}
export function drinkArt(recipe, id) {
  const color = recipe.color,
    accent = recipe.accent;
  return `<svg class="drink-art" viewBox="0 0 110 132" role="img" aria-label="${recipe.name} smoothie"><defs><linearGradient id="drink${id}" x1="0" x2="1"><stop stop-color="${accent}"/><stop offset=".28" stop-color="${color}"/><stop offset=".72" stop-color="${color}"/><stop offset="1" stop-color="${accent}"/></linearGradient><linearGradient id="glass${id}"><stop stop-color="#fff" stop-opacity=".5"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></linearGradient><filter id="shadow${id}" x="-100%" width="300%"><feGaussianBlur stdDeviation="3"/></filter></defs><ellipse cx="55" cy="119" rx="27" ry="5" fill="#5a4737" opacity=".14" filter="url(#shadow${id})"/><path d="m34 35 5 77q16 10 33 0l5-77Z" fill="url(#drink${id})"/><path d="m34 35 5 77q16 10 33 0l5-77Z" fill="url(#glass${id})"/><path d="M35 48q10 4 20 0t20 0v8q-20 6-40 0Z" fill="#f7e9df" opacity=".8"/><ellipse cx="55" cy="36" rx="22" ry="5" fill="${color}"/><path d="m64 11-9 39" stroke="#bead89" stroke-width="4"/><path d="m65 11-9 38" stroke="#e4d6b8" stroke-width="1.4"/><ellipse cx="55" cy="35" rx="23" ry="5" fill="#f6f2e5" opacity=".55"/><path d="M31 34h47v5q-23 5-47 0Z" fill="#f0ede1" opacity=".83"/><path d="m40 61 1.8 30" stroke="#fff" stroke-width="2" opacity=".35"/><text x="56" y="76" font-family="Georgia,serif" font-size="8.5" fill="#364535" text-anchor="middle">M&amp;T</text><text x="56" y="84" font-family="Arial,sans-serif" font-size="2.8" fill="#364535" text-anchor="middle" letter-spacing=".8">LOS ANGELES</text><path d="M49 91q6-9 12-4-5 8-12 4Z" fill="none" stroke="#364535" stroke-width=".6"/>${id.includes("berry") ? '<path d="M23 112q-8-7 0-12 8-3 12 4-2 10-12 8Z" fill="#b35c68"/><path d="m24 100-2-5 4 3 5-4-1 6" fill="#5b784a"/><circle cx="24" cy="105" r=".8" fill="#f1d1b7"/><circle cx="29" cy="107" r=".8" fill="#f1d1b7"/>' : '<path d="M23 110q-9-8 3-15 12 9-3 15Z" fill="#829668"/><path d="m23 112 4-14" stroke="#567143" stroke-width="1"/>'}</svg>`;
}
