# Smoothie Rush

A real-time, two-player smoothie competition set in a detailed 3D Los Angeles wellness market. Original Market & Tonic branding accompanies warm wooden shelving, stone counters, glass refrigerators, organic produce, stocked grocery aisles, customers, and a working tonic bar. The visual direction is inspired by premium LA groceries, including Erewhon; no official logo, product photography, or licensed brand asset is included.

## Publish a playable link

[Deploy Smoothie Rush on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ffeinmankate1-jpg%2FSmoothie-Rush)

Sign in to Render and deploy the included `render.yaml` blueprint. It requests one **free** Node web service with the frontend and multiplayer backend together. After deployment, open the service's public `https://…onrender.com` URL; that is the playable link to share with friends. No application secrets or database are required. Free hosting may take a moment to wake after inactivity. The cloud setup environment itself has no built-in public game preview.

## Run

Requires Node.js 22.12+ (tested with 24.19) and a browser with WebGL2.

```sh
cd /workspace/Smoothie-Rush
npm ci --cache /workspace/.cache/npm
npm run dev
```

The application and Socket.IO server share port **5173**. `PORT` overrides it. The server binds to `0.0.0.0`; use your hosting environment’s supported access mechanism. No account, external backend, database, or API key is required. Fonts are served locally.

```sh
npm test       # Game rules and real two-client network integration tests
npm run build # Production frontend
npm start     # Serve the production build and multiplayer server
```

With the development server running and Chromium installed:

```sh
npm run test:browser                # Two-browser gameplay and mobile rendering
FULL_MATCH=1 npm run test:browser   # Also complete a real 180-second match
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`, or `GAME_URL` to test a different server. Browser checks save screenshots to the ignored `test-results/` directory.

`GET /api/health` returns `{"ok":true,"game":"Smoothie Rush"}`.

## Play

- Start a **practice shift** to learn the market, or select **Play with a friend** to create a private room.
- Share the five-character room code or invite link. Your friend joins from another browser or device that can reach the same server. The host starts the shift; each shift lasts exactly **three minutes**.
- Select an order to follow its recipe. Collect its three ingredients from **01 Organic fruit**, **02 Greens & matcha**, and **03 Plant-based milks**. The two players share stock, which replenishes every 25 seconds.
- Take the tray to **04 The blend bar**, blend for 2.8 seconds, then serve at **05 Order pickup**. The first player to serve a matching smoothie wins that customer’s points. Customers leave after 75 seconds.
- Use **WASD**, arrow keys, or click-to-walk. **E** interacts with the nearest station; **1/2** choose ingredients. **Clear** returns unblended ingredients to stock.
- Customize your name and apron under **Your look**. Scores, inventories, movement, orders, blending, and the timer update live for both employees.

## Implementation

- `server/game.mjs`: authoritative game rules, finite stock, recipes, customer patience, scores, and timed rounds.
- `server/index.mjs`: Express/Vite hosting and Socket.IO rooms. Clients submit directions and interaction requests; they cannot set positions, scores, inventory, or time.
- `shared/game.mjs`: station locations, collision geometry, movement, and recipe definitions.
- `src/store.js`: Three.js market, generated material textures, lighting, animated characters, detailed appliances and products. Repeated products use GPU instancing; static geometry is merged. Software-rendered browsers use contact shadows to reduce load.
- `src/main.js`: live game interface, pathfinding, room sharing, customization, accessible dialogs and optional sound effects.
- `tests/`: rule tests and integration tests that start an isolated server and connect real clients.

Rooms live in memory in a **single server process**. A temporary connection loss or page reload preserves your room, inventory, score, and position for two minutes through a per-tab session. Remaining players keep their room, and hosting transfers automatically. Restarting the server clears rooms. Persistent sessions or multiple server instances would require a shared room store and Socket.IO adapter. Publishing the cloud environment saves the filesystem, not live matches.

## Visual references

The intended references are Erewhon’s public store imagery at `erewhon.com` and `erewhonmarket.com`. Those sites were unavailable under the setup environment’s network policy, so this version uses original procedural artwork based on the requested store characteristics rather than downloaded reference photographs. No remote images or fonts are needed at runtime.

Each cloud task is already isolated. Use the existing checkout; a separate Git worktree is unnecessary unless explicitly requested.
