import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { STATIONS, OUTFITS, RECIPES } from "../shared/game.mjs";

const palette = {
  plaster: "#eee9dc",
  walnut: "#765b40",
  oak: "#b39169",
  stone: "#ddd5c5",
  brass: "#b6a074",
  green: "#354c3e",
};
export function createStore(canvas, onDestination) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const gl = renderer.getContext(),
    debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const softwareRenderer =
    debugInfo &&
    /swiftshader|llvmpipe|software/i.test(
      gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
    );
  renderer.setPixelRatio(
    softwareRenderer ? 0.85 : Math.min(window.devicePixelRatio, 1.8),
  );
  renderer.setClearColor("#e7e4dc");
  renderer.shadowMap.enabled = !softwareRenderer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 150);
  camera.position.set(27, 31, 35);
  camera.lookAt(0, 0, -0.4);
  scene.add(new THREE.HemisphereLight("#fff4df", "#9c967f", 1.8));
  const sunlight = new THREE.DirectionalLight("#fff2d4", 3.2);
  sunlight.position.set(-15, 28, 15);
  sunlight.castShadow = true;
  Object.assign(sunlight.shadow.camera, {
    left: -22,
    right: 22,
    top: 22,
    bottom: -22,
    near: 1,
    far: 75,
  });
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.bias = -0.0003;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.radius = 3;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight("#eff4ff", 1.2);
  fill.position.set(15, 10, -10);
  scene.add(fill);
  const warm = new THREE.PointLight("#ffe6b4", 65, 24, 2);
  warm.position.set(-5, 5, -5);
  scene.add(warm);
  const materials = {};
  function material(color, roughness = 0.7, metalness = 0) {
    const key = `${color}/${roughness}/${metalness}`;
    return (materials[key] ||= softwareRenderer
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
  function texture(kind) {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    let seed = 426;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    ctx.fillStyle = kind === "wood" ? "#927454" : "#d6d0c3";
    ctx.fillRect(0, 0, 512, 512);
    if (kind === "wood") {
      for (let i = 0; i < 700; i++) {
        const x = rand() * 512;
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? "58,38,21" : "220,197,155"},${0.035 + rand() * 0.1})`;
        ctx.lineWidth = rand() * 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= 512; y += 10)
          ctx.lineTo(x + Math.sin(y / 60 + x / 20) * 3, y);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 45000; i++) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,250,238" : "95,86,72"},${rand() * 0.06})`;
        ctx.fillRect(
          rand() * 512,
          rand() * 512,
          1 + rand() * 3,
          1 + rand() * 2,
        );
      }
      if (kind === "floor") {
        ctx.strokeStyle = "#b9b3a5";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 510, 510);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
  const wood = softwareRenderer
    ? new THREE.MeshLambertMaterial({ map: texture("wood"), color: "#b3a38e" })
    : new THREE.MeshStandardMaterial({
        map: texture("wood"),
        roughness: 0.48,
        color: "#b3a38e",
      });
  const darkwood = wood.clone();
  darkwood.color.set("#8e775d");
  const stone = softwareRenderer
    ? new THREE.MeshLambertMaterial({ map: texture("stone"), color: "#f5efdf" })
    : new THREE.MeshStandardMaterial({
        map: texture("stone"),
        color: "#f5efdf",
        roughness: 0.35,
      });
  const floorTex = texture("floor");
  floorTex.repeat.set(14, 10);
  const floorMat = softwareRenderer
    ? new THREE.MeshLambertMaterial({ map: floorTex })
    : new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.32,
        metalness: 0.08,
      });
  const glass = softwareRenderer
    ? new THREE.MeshBasicMaterial({
        color: "#c6d9cf",
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: "#c6d9cf",
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
        metalness: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
  function mesh(geometry, mat, x, y, z, parent = scene, shadow = true) {
    const obj = new THREE.Mesh(
      geometry,
      typeof mat === "string" ? material(mat) : mat,
    );
    obj.position.set(x, y, z);
    obj.castShadow = shadow;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 9);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
  function box(x, y, z, w, h, d, mat, parent = scene, shadow = true) {
    const o = mesh(boxGeometry, mat, x, y, z, parent, shadow);
    o.scale.set(w, h, d);
    return o;
  }
  function sphere(x, y, z, r, mat, parent = scene, scale = [1, 1, 1]) {
    const o = mesh(sphereGeometry, mat, x, y, z, parent, false);
    o.scale.set(r * scale[0], r * scale[1], r * scale[2]);
    return o;
  }
  function cylinder(x, y, z, r, h, mat, parent = scene) {
    const o = mesh(cylinderGeometry, mat, x, y, z, parent);
    o.scale.set(r, h, r);
    return o;
  }
  function textPlane(text, x, y, z, w, h, opts = {}) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = Math.round((1024 * h) / w);
    const ctx = c.getContext("2d");
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.fillStyle = opts.color || "#3b4438";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = text.split("\n");
    const fontSize =
      opts.size ||
      Math.min(
        c.height / (lines.length + 0.6),
        c.width / (Math.max(...lines.map((l) => l.length)) * 0.64),
      );
    ctx.font = `${opts.weight || "400"} ${fontSize}px ${opts.serif ? "Georgia" : "Arial"}`;
    lines.forEach((line, i) =>
      ctx.fillText(
        line,
        c.width / 2,
        c.height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.45,
      ),
    );
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      x,
      y,
      z,
      opts.parent || scene,
      false,
    );
  }
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext("2d");
  const gradient = shadowCtx.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(46,37,23,.42)");
  gradient.addColorStop(1, "rgba(46,37,23,0)");
  shadowCtx.fillStyle = gradient;
  shadowCtx.fillRect(0, 0, 128, 128);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  });
  function contact(x, z, w, d, parent = scene) {
    const o = mesh(
      new THREE.PlaneGeometry(w, d),
      shadowMat,
      x,
      0.034,
      z,
      parent,
      false,
    );
    o.rotation.x = -Math.PI / 2;
    return o;
  }
  const batches = new Map();
  const temp = new THREE.Object3D();
  function instance(kind, color, x, y, z, sx, sy, sz, rotation = 0) {
    if (x < 5 && z < -3 && z > -6 && y < 3.3) {
      y *= 0.74;
      sy *= 0.74;
    }
    const key = `${kind}${color}`;
    if (!batches.has(key)) batches.set(key, { kind, color, matrices: [] });
    temp.position.set(x, y, z);
    temp.rotation.set(0, rotation, 0);
    temp.scale.set(sx, sy, sz);
    temp.updateMatrix();
    batches.get(key).matrices.push(temp.matrix.clone());
  }
  // Travertine floor and plaster envelope; the front walls are cut away for play.
  box(0, -0.28, 0, 28, 0.55, 20, stone);
  box(0, -0.015, 0, 27.9, 0.08, 19.9, floorMat);
  box(0, 2.9, -10, 28, 5.8, 0.22, palette.plaster);
  box(-14, 2.45, 0, 0.22, 4.9, 20, palette.plaster);
  box(0, 0.28, -9.82, 27.8, 0.56, 0.1, darkwood);
  box(-13.82, 0.28, 0, 0.1, 0.56, 19.8, darkwood);
  for (let x = -13; x <= 13; x += 4.4)
    box(x, 2.8, -9.83, 0.045, 5.35, 0.06, "#d6cebb", scene, false);
  // Warm, walnut-fronted tonic bar and marble worktop.
  contact(-4.5, -4.4, 19.5, 4.3);
  box(-4.5, 0.85, -4.45, 18, 1.7, 2.7, darkwood);
  for (let x = -13.35; x < 4.5; x += 0.19)
    box(x, 0.84, -3.078, 0.038, 1.54, 0.045, "#69513a", scene, false);
  box(-4.5, 1.77, -4.45, 18.4, 0.23, 2.9, stone);
  box(-4.5, 0.12, -2.99, 18, 0.11, 0.1, "#b49b72");
  // Back bar with appliances, sink, open shelving, and a recognizable restrained wordmark.
  box(-5.5, 0.8, -8.3, 16, 1.6, 2, wood);
  box(-5.5, 1.67, -8.3, 16.3, 0.15, 2.2, stone);
  textPlane("MARKET & TONIC", -5.4, 4.43, -9.84, 9.8, 0.7, {
    serif: true,
    size: 90,
  });
  textPlane(
    "ORGANIC   ·   CULTIVATED   ·   LOS ANGELES",
    -5.4,
    3.83,
    -9.83,
    8.2,
    0.27,
    { size: 30 },
  );
  for (const x of [-10, -1.2]) {
    box(x, 2.75, -9.3, 5.1, 0.12, 0.95, wood);
    for (let i = 0; i < 12; i++) {
      const px = x - 2.25 + i * 0.41;
      instance(
        "cyl",
        ["#6f7952", "#b8a373", "#cbbd91"][i % 3],
        px,
        3.09,
        -9.2,
        0.115,
        0.55,
        0.115,
      );
      instance("box", "#f1ebdc", px, 3.08, -9.06, 0.13, 0.23, 0.015);
      instance("cyl", "#4a5140", px, 3.4, -9.2, 0.09, 0.06, 0.09);
    }
  }
  box(-6.1, 1.77, -8.2, 1.55, 0.06, 0.9, "#9b9c94");
  box(-6.1, 1.8, -8.2, 1.27, 0.03, 0.65, "#525c53");
  cylinder(-6.1, 2.1, -8.57, 0.045, 0.65, material("#bbc0b3", 0.2, 0.8));
  const tap = cylinder(
    -6.1,
    2.4,
    -8.37,
    0.045,
    0.4,
    material("#bbc0b3", 0.2, 0.8),
  );
  tap.rotation.x = Math.PI / 2;
  // A framed tonic menu in the rear wall.
  box(-5.4, 2.81, -9.77, 2.8, 1.27, 0.09, darkwood);
  textPlane(
    "THE TONIC BAR\nSTRAWBERRY CLOUD   18\nGREEN GLOW   16\nMATCHA RITUAL   18",
    -5.4,
    2.82,
    -9.7,
    2.6,
    1.08,
    { bg: "#ece6d5", size: 53, color: "#374238" },
  );
  // Ingredient bins: steel hotel pans, berries, bananas, greens, matcha and bottled milks.
  for (let n = 0; n < 6; n++) {
    const x = -11 + n * 1.38;
    box(x, 1.98, -4.25, 1.11, 0.22, 0.88, "#a9aaa0");
    box(
      x,
      2.1,
      -4.25,
      0.93,
      0.025,
      0.69,
      ["#762b4e", "#d2b955", "#63783e", "#76924b", "#e3d4b9", "#ced9cb"][n],
    );
    for (let i = 0; i < 12; i++)
      instance(
        "sphere",
        ["#a94b61", "#dccc67", "#4f6b36", "#89a464", "#e5dfc6", "#c7d3c4"][n],
        x - 0.34 + (i % 4) * 0.22,
        2.15,
        -4.47 + Math.floor(i / 4) * 0.22,
        n === 1 ? 0.16 : 0.09,
        0.075,
        0.085,
      );
  }
  for (let i = 0; i < 6; i++) {
    const x = -3.75 + (i % 3) * 0.55;
    const z = -4.5 - Math.floor(i / 3) * 0.45;
    cylinder(x, 2.16, z, 0.13, 0.52, "#ede3ce");
    cylinder(x, 2.46, z, 0.075, 0.09, "#344d3c");
    box(x, 2.18, z + 0.13, 0.18, 0.18, 0.01, "#c4c8a3", scene, false);
  }
  const blenderJars = [];
  for (const x of [1, 2.6, 4]) {
    box(x, 2.04, -4.35, 0.58, 0.35, 0.6, "#3f4440");
    box(x, 2.075, -4.037, 0.18, 0.07, 0.018, "#d1d4c7", scene, false);
    const jar = mesh(
      new THREE.CylinderGeometry(0.24, 0.2, 0.65, 6),
      glass,
      x,
      2.55,
      -4.35,
    );
    blenderJars.push(jar);
    cylinder(x, 2.89, -4.35, 0.26, 0.09, "#2b3430");
    const handle = mesh(
      new THREE.TorusGeometry(0.17, 0.024, 6, 16, Math.PI * 1.6),
      "#8c9f92",
      x + 0.29,
      2.6,
      -4.35,
    );
    handle.rotation.z = -Math.PI / 2;
  }
  // Premium refrigerated cases with lit interiors, neatly faced products and real glass.
  function fridge(x, z, w, rotation = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    scene.add(group);
    box(0, 1.7, -0.6, w, 3.4, 0.18, "#454d44", group);
    box(0, 1.73, -0.49, w - 0.18, 3.08, 0.02, "#d8dccf", group);
    box(-w / 2 + 0.07, 1.7, 0.06, 0.14, 3.4, 1.45, "#454d44", group);
    box(w / 2 - 0.07, 1.7, 0.06, 0.14, 3.4, 1.45, "#454d44", group);
    box(0, 3.34, 0.06, w, 0.13, 1.45, "#454d44", group);
    box(0, 0.1, 0.06, w, 0.2, 1.45, "#454d44", group);
    const bays = Math.round(w / 1.65);
    for (let b = 0; b < bays; b++) {
      const px = -w / 2 + ((b + 0.5) * w) / bays;
      box(px, 1.8, 0.8, w / bays - 0.1, 3.05, 0.025, glass, group, false);
      box(
        px + w / bays / 2 - 0.04,
        1.7,
        0.84,
        0.035,
        3.23,
        0.07,
        "#667062",
        group,
      );
      box(
        px + w / bays / 2 - 0.18,
        1.77,
        0.88,
        0.035,
        0.65,
        0.06,
        material("#c3bca4", 0.2, 0.6),
        group,
      );
      box(
        px - w / bays / 2 + 0.07,
        1.75,
        0.81,
        0.025,
        2.8,
        0.025,
        new THREE.MeshBasicMaterial({ color: "#f5e9c6" }),
        group,
        false,
      );
    }
    for (let s = 0; s < 4; s++) {
      const y = 0.47 + s * 0.67;
      box(0, y, 0.06, w - 0.18, 0.065, 1.15, "#b4bbab", group);
      for (let b = 0; b < bays * 4; b++) {
        const px = -w / 2 + 0.26 + (b * (w - 0.3)) / (bays * 4);
        cylinder(
          px,
          y + 0.23,
          0.43,
          0.085,
          0.37,
          ["#c7d09b", "#d9b277", "#b86b60", "#dfd8b6"][s],
          group,
        );
        cylinder(px, y + 0.43, 0.43, 0.062, 0.04, "#f1eee0", group);
        box(px, y + 0.23, 0.525, 0.11, 0.16, 0.01, "#f0ebda", group, false);
      }
    }
    textPlane("COLD-PRESSED  /  ALWAYS FRESH", 0, 3.17, 0.89, w - 0.2, 0.21, {
      parent: group,
      bg: "#444d43",
      color: "#eee9d8",
      size: 36,
    });
  }
  fridge(9.1, -8.6, 8.6);
  fridge(-12.95, 0, 5.8, Math.PI / 2);
  textPlane("NOURISH YOUR EVERYDAY", 9, 4.35, -9.84, 7.6, 0.34, { size: 43 });
  // Tall, stocked grocery aisles. Small labels and varying package forms create scale.
  function aisle(x, z, title) {
    contact(x, z, 3.8, 6.3);
    box(x, 0.16, z, 2.15, 0.3, 4.6, darkwood);
    box(x, 1.32, z, 0.12, 2.5, 4.55, wood);
    for (const zz of [z - 2.24, z + 2.24])
      box(x, 1.4, zz, 2.18, 2.8, 0.12, darkwood);
    for (let s = 0; s < 4; s++) {
      const y = 0.36 + s * 0.68;
      box(x, y, z, 2.13, 0.08, 4.6, wood);
      for (const side of [-1, 1]) {
        box(
          x + side * 1.067,
          y + 0.035,
          z,
          0.026,
          0.1,
          4.39,
          "#ede5d3",
          scene,
          false,
        );
        for (let i = 0; i < 13; i++) {
          const zz = z - 2.02 + i * 0.33;
          const px = x + side * 0.68;
          const color = [
            "#c5b58b",
            "#597459",
            "#e1d7b8",
            "#a77c5d",
            "#bac5aa",
            "#765641",
          ][(i + s * 2) % 6];
          if (s === 2) {
            instance("cyl", color, px, y + 0.26, zz, 0.1, 0.42, 0.1);
            instance("cyl", "#ddd2b7", px, y + 0.485, zz, 0.08, 0.035, 0.08);
          } else {
            instance("box", color, px, y + 0.25, zz, 0.36, 0.44, 0.24);
            instance(
              "box",
              "#f0e9d8",
              px + side * 0.185,
              y + 0.28,
              zz,
              0.012,
              0.19,
              0.18,
            );
          }
          instance(
            "box",
            "#657359",
            x + side * 1.085,
            y + 0.04,
            zz,
            0.013,
            0.036,
            0.1,
          );
        }
      }
    }
    textPlane(title, x, 2.67, z + 2.315, 1.93, 0.34, {
      bg: "#eee6d5",
      size: 58,
    });
    box(x, 2.84, z, 2.2, 0.09, 4.7, wood);
    for (let i = 0; i < 6; i++) {
      cylinder(x, 3.02, z - 1.8 + i * 0.71, 0.18, 0.29, "#d9cbb1");
      for (let j = 0; j < 5; j++)
        sphere(
          x + Math.sin(j * 2) * 0.15,
          3.25 + j * 0.015,
          z - 1.8 + i * 0.71 + Math.cos(j * 2) * 0.13,
          0.17,
          "#748056",
          scene,
          [1, 0.6, 1],
        );
    }
  }
  aisle(4.9, 1.7, "PANTRY");
  aisle(10, 2.7, "DAILY ESSENTIALS");
  // Angled wooden produce crates overflowing with meticulously arranged organic fruit.
  contact(-9, 3.2, 5.8, 4.1);
  box(-9, 0.64, 3.2, 4.1, 1.27, 2.2, darkwood);
  for (let i = 0; i < 4; i++) {
    const x = -10.5 + i;
    box(x, 1.35, 3.2, 0.96, 0.18, 2.1, wood);
    for (const z of [2.2, 4.2]) box(x, 1.57, z, 0.96, 0.34, 0.05, wood);
    for (const xx of [x - 0.47, x + 0.47])
      box(xx, 1.57, 3.2, 0.06, 0.34, 2.05, wood);
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 3; c++) {
        const px = x - 0.3 + c * 0.29,
          pz = 2.45 + r * 0.24;
        instance(
          "sphere",
          ["#9dba6f", "#dba052", "#bb5844", "#bcbd57"][i],
          px,
          1.6 + (r % 2) * 0.04,
          pz,
          0.145,
          0.14,
          0.145,
        );
        instance("box", "#567341", px + 0.04, 1.75, pz, 0.06, 0.025, 0.07, 0.7);
      }
    const label = textPlane(
      ["AVOCADOS", "CITRUS", "APPLES", "PEARS"][i],
      x,
      1.15,
      4.325,
      0.8,
      0.16,
      { bg: "#f3ebd7", size: 70 },
    );
  }
  textPlane("FARM FRESH", -9, 0.68, 4.33, 2.9, 0.33, {
    color: "#eee5d0",
    size: 75,
  });
  // Pickup island with a retail pastry display, POS, smoothie cups and bags.
  contact(-3.5, -1.4, 5, 2.7);
  box(-3.5, 0.72, -1.4, 3.7, 1.45, 1.3, wood);
  box(-3.5, 1.51, -1.4, 3.9, 0.15, 1.5, stone);
  box(-4.5, 1.87, -1.4, 1.2, 0.63, 1.04, glass);
  box(-4.5, 1.61, -1.4, 1.2, 0.05, 1.04, "#b7b9aa");
  for (let i = 0; i < 5; i++)
    sphere(
      -4.88 + i * 0.19,
      1.73,
      -1.16,
      0.11,
      "#ac7e45",
      scene,
      [1, 0.55, 0.7],
    );
  const pos = box(-2.7, 1.96, -1.45, 0.7, 0.45, 0.08, "#303b32");
  pos.rotation.x = -0.2;
  box(-2.7, 1.68, -1.45, 0.09, 0.3, 0.1, "#687467");
  for (let i = 0; i < 3; i++) {
    const x = -3.75 + i * 0.45;
    cylinder(x, 1.88, -0.96, 0.13, 0.5, ["#d5a0ab", "#9fab78", "#c5c396"][i]);
    cylinder(x, 2.15, -0.96, 0.15, 0.045, "#f0ede0");
    cylinder(x + 0.055, 2.31, -0.96, 0.015, 0.28, "#b6a180");
    textPlane("M&T", x, 1.9, -0.817, 0.16, 0.13, { size: 240 });
  }
  textPlane("ORDER PICKUP", -3.5, 1.09, -0.735, 2.5, 0.28, { size: 64 });
  // Dried goods wall, plants and warm pendant lighting.
  function plant(x, z, scale = 1) {
    cylinder(x, 0.4 * scale, z, 0.37 * scale, 0.8 * scale, "#a79c80");
    cylinder(x, 1.2 * scale, z, 0.045 * scale, 1.4 * scale, "#72664a");
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4;
      const yy = 1.1 + i * 0.12;
      const leaf = sphere(
        x + Math.sin(a) * 0.34 * scale,
        yy * scale,
        z + Math.cos(a) * 0.34 * scale,
        0.31 * scale,
        ["#4e664a", "#75845a", "#5c744f"][i % 3],
        scene,
        [0.6, 1.25, 0.36],
      );
      leaf.rotation.set(0.3, a, 0.5);
    }
  }
  plant(-12.3, 7.9, 1.2);
  plant(12.4, -5, 1.3);
  plant(-12.3, -6.4, 0.85);
  for (const [x, z] of [
    [-9.8, -5],
    [-3.2, -5],
    [3.6, -5],
  ]) {
    cylinder(x, 4.7, z, 0.02, 1.4, "#423d30");
    mesh(
      new THREE.ConeGeometry(0.68, 0.45, 32, 1, true),
      material("#c8b994", 0.3, 0.3),
      x,
      4.08,
      z,
    );
    const disc = cylinder(
      x,
      3.88,
      z,
      0.49,
      0.03,
      new THREE.MeshBasicMaterial({ color: "#ffe7aa" }),
    );
  }
  // A chalkboard and a welcome mat near the market entrance.
  box(-6.05, 0.6, 6.65, 0.06, 1.2, 0.06, wood);
  box(-4.95, 0.6, 6.65, 0.06, 1.2, 0.06, wood);
  box(-5.5, 1.22, 6.65, 1.35, 1.1, 0.1, wood);
  textPlane(
    "GOOD THINGS\nGROW HERE\nOrganic, always.",
    -5.5,
    1.22,
    6.71,
    1.2,
    0.94,
    { bg: "#34463a", color: "#efe8d7", size: 110, serif: true },
  );
  box(-1, 0.04, 8.55, 5, 0.045, 1.25, "#a99b7d", scene, false);
  const matText = textPlane("MARKET & TONIC", -1, 0.072, 8.55, 4.1, 0.65, {
    color: "#4c4e39",
    size: 110,
  });
  matText.rotation.x = -Math.PI / 2;
  // Floor markers give interaction destinations a subtle physical presence.
  const stationMarkers = [];
  STATIONS.forEach((s, i) => {
    const ring = mesh(
      new THREE.RingGeometry(0.45, 0.49, 48),
      new THREE.MeshBasicMaterial({
        color: "#918463",
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      s.x,
      0.047,
      s.z,
      scene,
      false,
    );
    ring.rotation.x = -Math.PI / 2;
    const number = textPlane(
      String(i + 1).padStart(2, "0"),
      s.x,
      0.052,
      s.z,
      0.49,
      0.32,
      { size: 450, color: "#81765d" },
    );
    number.rotation.x = -Math.PI / 2;
    stationMarkers.push(ring);
  });
  // Combine repeated small products to keep a detailed store fast on ordinary laptops.
  scene.traverse((obj) => {
    if (
      !obj.isMesh ||
      obj.parent !== scene ||
      obj.position.y >= 3.3 ||
      obj.position.x >= 5
    )
      return;
    if (obj.position.z < -3 && obj.position.z > -6) {
      obj.position.y *= 0.74;
      obj.scale.y *= 0.74;
    }
    if (obj.position.z < -7 && obj.position.z > -9 && obj.position.y < 2.6) {
      obj.position.y *= 0.74;
      obj.scale.y *= 0.74;
    }
    if (
      obj.position.x > -5.5 &&
      obj.position.x < -1.5 &&
      obj.position.z > -2.2 &&
      obj.position.z < -0.6
    ) {
      obj.position.y *= 0.8;
      obj.scale.y *= 0.8;
    }
  });
  for (const { kind, color, matrices } of batches.values()) {
    const obj = new THREE.InstancedMesh(
      kind === "sphere"
        ? sphereGeometry
        : kind === "cyl"
          ? cylinderGeometry
          : boxGeometry,
      material(color, 0.55),
      matrices.length,
    );
    matrices.forEach((m, i) => obj.setMatrixAt(i, m));
    obj.receiveShadow = true;
    scene.add(obj);
  }
  // Merge static fixtures by material so hundreds of detailed packages and shelves
  // do not become hundreds of separate GPU draw calls. Animated objects stay separate.
  scene.updateMatrixWorld(true);
  const staticBatches = new Map(),
    staticMeshes = [];
  scene.traverse((obj) => {
    if (
      obj.isMesh &&
      !obj.isInstancedMesh &&
      !obj.material.transparent &&
      !blenderJars.includes(obj) &&
      !stationMarkers.includes(obj)
    )
      staticMeshes.push(obj);
  });
  for (const obj of staticMeshes) {
    const key = `${obj.material.uuid}/${obj.castShadow}`;
    if (!staticBatches.has(key))
      staticBatches.set(key, {
        material: obj.material,
        castShadow: obj.castShadow,
        geometries: [],
      });
    staticBatches
      .get(key)
      .geometries.push(obj.geometry.clone().applyMatrix4(obj.matrixWorld));
    obj.parent.remove(obj);
  }
  for (const batch of staticBatches.values()) {
    const merged = mergeGeometries(batch.geometries);
    if (!merged) continue;
    const obj = new THREE.Mesh(merged, batch.material);
    obj.castShadow = batch.castShadow;
    obj.receiveShadow = true;
    scene.add(obj);
    batch.geometries.forEach((g) => g.dispose());
  }
  const players = new Map(),
    customers = [];
  function avatar(outfit = OUTFITS[0], employee = true, variant = 0) {
    const group = new THREE.Group();
    scene.add(group);
    const skin = ["#d3a17e", "#b88059", "#8a5c42", "#e1b797"][variant % 4];
    const trouser = employee
      ? "#3b3e35"
      : ["#656961", "#676052", "#454b5b"][variant % 3];
    const shadow = contact(0, 0, 1.3, 1.3, group);
    const legs = [],
      arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.15, 0.75, 0);
      group.add(leg);
      cylinder(0, -0.32, 0, 0.1, 0.65, trouser, leg);
      box(0, -0.66, 0.08, 0.21, 0.13, 0.36, "#d6d2c7", leg);
      legs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 0.32, 1.44, 0);
      group.add(arm);
      cylinder(0, -0.09, 0, 0.095, 0.32, employee ? "#eee6d8" : outfit, arm);
      cylinder(0, -0.37, 0, 0.075, 0.28, skin, arm);
      sphere(0, -0.53, 0, 0.081, skin, arm);
      arms.push(arm);
    }
    const torso = mesh(
      new THREE.CylinderGeometry(0.26, 0.22, 0.64, 12),
      employee ? "#ece6d9" : outfit,
      0,
      1.2,
      0,
      group,
    );
    torso.scale.z = 0.67;
    let apron;
    const outfitMeshes = [];
    if (employee) {
      apron = box(0, 1.14, 0.184, 0.43, 0.66, 0.07, outfit, group);
      outfitMeshes.push(
        apron,
        box(0, 1.02, 0.23, 0.26, 0.19, 0.022, material(outfit), group),
      );
      box(0.1, 1.39, 0.23, 0.12, 0.075, 0.02, "#e7dfc9", group, false);
      for (const side of [-1, 1]) {
        const strap = box(
          side * 0.15,
          1.45,
          0.16,
          0.035,
          0.27,
          0.035,
          outfit,
          group,
        );
        strap.rotation.z = side * 0.15;
        outfitMeshes.push(strap);
      }
    }
    cylinder(0, 1.56, 0, 0.085, 0.19, skin, group);
    sphere(0, 1.81, 0, 0.225, skin, group, [0.83, 1.15, 0.87]);
    const hair = sphere(
      0,
      1.91,
      -0.025,
      0.23,
      variant % 3 === 0 ? "#604c37" : "#35352c",
      group,
      [0.86, 0.67, 0.92],
    );
    sphere(0.084, 1.81, 0.17, 0.017, "#30352c", group);
    sphere(-0.084, 1.81, 0.17, 0.017, "#30352c", group);
    sphere(0, 1.76, 0.194, 0.035, skin, group, [0.55, 0.7, 1]);
    if (employee) {
      outfitMeshes.push(
        cylinder(0, 1.99, 0, 0.205, 0.1, outfit, group),
        box(0, 1.96, 0.18, 0.34, 0.03, 0.19, outfit, group),
      );
    } else if (variant % 2) sphere(0, 1.92, -0.19, 0.12, "#524334", group);
    const drink = cylinder(0.44, 1.05, 0.2, 0.11, 0.35, "#d99aa9", group);
    cylinder(0, 0.19, 0, 0.12, 0.03, "#e9e7d9", drink);
    drink.visible = false;
    return {
      group,
      legs,
      arms,
      apron,
      torso,
      drink,
      outfit,
      outfitMeshes,
      shadow,
      walking: false,
      target: null,
    };
  }
  const customerRoutes = [
    [
      [-2.9, 1.35],
      [-2.9, 2.5],
      [-2.9, 3.7],
    ],
    [
      [-0.7, 2.8],
      [1.7, 2.8],
      [2.4, 0.4],
      [2.4, 5.5],
      [-0.7, 6],
    ],
    [
      [7.4, 6.2],
      [7.4, 2.4],
      [7.4, -0.5],
      [7.4, 6.2],
    ],
    [
      [-10, 6.1],
      [-7, 6.1],
      [-6, 3.1],
      [-6, 6.1],
    ],
    [
      [12.1, 5.8],
      [12.1, 1.6],
      [12.1, -2.5],
      [12.1, 5.8],
    ],
    [
      [0.4, 7.5],
      [3.1, 7.5],
      [5.5, 7.5],
      [9.5, 7.5],
    ],
  ];
  for (let i = 0; i < 10; i++) {
    const person = avatar(
      ["#c7b798", "#c0c0b3", "#8e9e85", "#8a6d5e", "#d2c7b5"][i % 5],
      false,
      i,
    );
    const route = customerRoutes[i < 3 ? 0 : ((i - 2) % 5) + 1];
    person.route = route;
    person.stop = i < 3 ? i : i % route.length;
    person.wait = i < 3 ? Infinity : 2 + i;
    person.queued = i < 3;
    person.group.position.set(route[person.stop][0], 0, route[person.stop][1]);
    person.group.rotation.y = Math.PI;
    customers.push(person);
    if (i === 4 || i === 8) {
      box(0.38, 0.62, 0, 0.3, 0.47, 0.18, "#b4a181", person.group);
    }
  }
  // Barista behind the counter stays at the workbench, subtly preparing a drink.
  const barista = avatar("#b39a73", true, 2);
  barista.group.position.set(-6, 0, -6.8);
  barista.group.rotation.y = 0;
  const targetRing = mesh(
    new THREE.RingGeometry(0.4, 0.45, 48),
    new THREE.MeshBasicMaterial({
      color: "#496a51",
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    0,
    0.06,
    0,
    scene,
    false,
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.visible = false;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, point)) {
      onDestination(point.x, point.z);
      targetRing.position.set(point.x, 0.06, point.z);
      targetRing.visible = true;
    }
  });
  const labels = new Map();
  function updatePlayers(state, myId) {
    const active = new Set(Object.keys(state.players));
    for (const [id, p] of players)
      if (!active.has(id)) {
        scene.remove(p.group);
        labels.get(id)?.remove();
        labels.delete(id);
        players.delete(id);
      }
    for (const [id, data] of Object.entries(state.players)) {
      let p = players.get(id);
      if (!p) {
        p = avatar(data.outfit, true, id === myId ? 0 : 1);
        p.group.position.set(data.x, 0, data.z);
        players.set(id, p);
        const label = document.createElement("div");
        label.className = `player-label ${id === myId ? "is-you" : ""}`;
        label.innerHTML =
          '<span class="player-dot"></span><span class="player-name"></span>';
        canvas.parentElement.append(label);
        labels.set(id, label);
        const ring = mesh(
          new THREE.RingGeometry(0.36, 0.42, 48),
          new THREE.MeshBasicMaterial({
            color: id === myId ? "#486948" : "#b78d61",
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
          0,
          0.05,
          0,
          p.group,
          false,
        );
        ring.rotation.x = -Math.PI / 2;
      }
      const nameElement = labels.get(id).querySelector(".player-name");
      const name =
        id === myId
          ? `${data.name === "You" ? "You" : data.name} · YOU`
          : `${data.name}${data.online === false ? " · RECONNECTING" : ""}`;
      if (nameElement.textContent !== name) nameElement.textContent = name;
      labels.get(id).classList.toggle("is-offline", data.online === false);
      p.target = data;
      p.walking =
        Math.hypot(p.group.position.x - data.x, p.group.position.z - data.z) >
        0.025;
      p.drink.visible = !!data.drink;
      if (data.drink) p.drink.material = material(RECIPES[data.drink].color);
      if (p.outfit !== data.outfit) {
        p.outfit = data.outfit;
        p.outfitMeshes.forEach((m) => {
          m.material = material(data.outfit);
        });
      }
    }
    customers
      .filter((c) => c.queued)
      .forEach((c, i) => {
        c.group.visible = state.phase !== "playing" || i < state.orders.length;
      });
    blenderJars.forEach((jar) => {
      jar.userData.blending = Object.values(state.players).some(
        (p) => p.blendingUntil,
      );
    });
  }
  function highlightStation(id) {
    stationMarkers.forEach((m, i) => {
      const active = STATIONS[i].id === id;
      m.material.color.set(active ? "#416344" : "#918463");
      m.material.opacity = active ? 0.9 : 0.4;
      m.scale.setScalar(active ? 1.15 : 1);
    });
  }
  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const span = aspect < 1.3 ? 38 / aspect : 27.5;
    camera.left = (-span * aspect) / 2;
    camera.right = (span * aspect) / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  let last = performance.now(),
    alive = true;
  const projected = new THREE.Vector3();
  function animate(now) {
    if (!alive) return;
    if (now - last < (softwareRenderer ? 90 : 30) || document.hidden) {
      requestAnimationFrame(animate);
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const [id, p] of players) {
      if (p.target) {
        p.group.position.x = THREE.MathUtils.damp(
          p.group.position.x,
          p.target.x,
          18,
          dt,
        );
        p.group.position.z = THREE.MathUtils.damp(
          p.group.position.z,
          p.target.z,
          18,
          dt,
        );
        let delta = p.target.angle - p.group.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        p.group.rotation.y += delta * Math.min(dt * 14, 1);
        const gait = p.walking
          ? Math.sin(now / 120) * 0.52
          : Math.sin(now / 950) * 0.025;
        p.legs[0].rotation.x = gait;
        p.legs[1].rotation.x = -gait;
        p.arms[0].rotation.x = -gait * 0.75;
        p.arms[1].rotation.x = p.drink.visible ? -0.6 : gait * 0.75;
        projected
          .set(p.group.position.x, 2.4, p.group.position.z)
          .project(camera);
        const label = labels.get(id);
        label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * canvas.clientWidth}px, ${(-projected.y * 0.5 + 0.5) * canvas.clientHeight}px) translate(-50%, -100%)`;
      }
    }
    for (const c of customers) {
      c.wait -= dt;
      let moving = false;
      if (c.wait <= 0) {
        const goal = c.route[(c.stop + 1) % c.route.length],
          dx = goal[0] - c.group.position.x,
          dz = goal[1] - c.group.position.z,
          dist = Math.hypot(dx, dz);
        if (dist < 0.1) {
          c.stop = (c.stop + 1) % c.route.length;
          c.wait = 3.5 + c.stop * 1.7;
        } else {
          moving = true;
          c.group.position.x += (dx / dist) * dt * 0.65;
          c.group.position.z += (dz / dist) * dt * 0.65;
          c.group.rotation.y = Math.atan2(dx, dz);
        }
      }
      const gait = moving ? Math.sin(now / 190) * 0.35 : 0;
      c.legs[0].rotation.x = gait;
      c.legs[1].rotation.x = -gait;
      c.arms[0].rotation.x = -gait;
      c.arms[1].rotation.x = gait;
    }
    barista.arms[0].rotation.x = -0.7 + Math.sin(now / 600) * 0.12;
    barista.arms[1].rotation.x = -0.7 - Math.sin(now / 600) * 0.12;
    blenderJars.forEach((jar) => {
      jar.rotation.z = jar.userData.blending ? Math.sin(now / 25) * 0.025 : 0;
    });
    targetRing.material.opacity = 0.4 + Math.sin(now / 300) * 0.2;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  return {
    updatePlayers,
    highlightStation,
    clearTarget: () => {
      targetRing.visible = false;
    },
    project: (x, z) => {
      const p = new THREE.Vector3(x, 0, z).project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * canvas.clientWidth,
        y: (-p.y * 0.5 + 0.5) * canvas.clientHeight,
      };
    },
    dispose: () => {
      alive = false;
      observer.disconnect();
      renderer.dispose();
    },
  };
}
