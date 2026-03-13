import * as THREE from "three";

export function createCityscape(scene) {

  // ── Building Configuration ────────────────────────────────────────────────
  const CITY_RADIUS = 150;      // how far from centre the buildings sit
  const BUILDING_COUNT = 100;   // number of buildings around the perimeter
  const MIN_HEIGHT = 5;        // shortest building height
  const MAX_HEIGHT = 40;       // tallest building height
  const MIN_WIDTH = 6;         // narrowest building
  const MAX_WIDTH = 10;        // widest building

  // Cartoon building colours — dark, moody, urban palette
  const BUILDING_COLOURS = [
    0x1a1a2e,  // deep navy
    0x16213e,  // dark blue
    0x0f3460,  // midnight blue
    0x1b1b2f,  // dark purple
    0x2d2d44,  // dark grey blue
    0x1a1a1a,  // near black
  ];

  // Window colour — warm yellow glow like lights on inside
  const WINDOW_COLOUR = 0xffdd88;

  // ── Generate Buildings ────────────────────────────────────────────────────
  for (let i = 0; i < BUILDING_COUNT; i++) {

    // Spread buildings evenly around a circle with some random offset
    const angle = (i / BUILDING_COUNT) * Math.PI * 2;
    const radiusOffset = (Math.random() - 0.5) * 20;
    const radius = CITY_RADIUS + radiusOffset;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Random building dimensions
    const width  = MIN_WIDTH  + Math.random() * (MAX_WIDTH  - MIN_WIDTH);
    const depth  = MIN_WIDTH  + Math.random() * (MAX_WIDTH  - MIN_WIDTH);
    const height = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);

    // ── Building Body ───────────────────────────────────────────────────────
    const buildingGeo = new THREE.BoxGeometry(width, height, depth);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: BUILDING_COLOURS[Math.floor(Math.random() * BUILDING_COLOURS.length)],
      roughness: 0.9,
      metalness: 0.1,
    });

    const building = new THREE.Mesh(buildingGeo, buildingMat);

    // Position building so its base sits on the ground plane
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    // ── Windows ──────────────────────────────────────────────────────────
    // Windows are placed on all 4 faces of each building.
    // Emissive material means they glow without needing light sources.
    const windowRows    = Math.floor(height / 3);
    const windowColumns = Math.floor(width  / 2.5);

    // All 4 face directions
    const faces = [
      { axis: 'z', sign:  1, rot: 0 },
      { axis: 'z', sign: -1, rot: Math.PI },
      { axis: 'x', sign:  1, rot: Math.PI / 2 },
      { axis: 'x', sign: -1, rot: -Math.PI / 2 },
    ];

    faces.forEach(face => {
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowColumns; col++) {

          if (Math.random() < 0.35) continue;

          const windowColour = Math.random() > 0.7 ? 0xaaddff : 0xffdd88;

          const windowGeo = new THREE.PlaneGeometry(0.5, 0.7);
          const windowMat = new THREE.MeshStandardMaterial({
            color: windowColour,
            emissive: windowColour,
            emissiveIntensity: Math.random() * 0.5 + 0.5,
          });

          const win = new THREE.Mesh(windowGeo, windowMat);

          const wx = -width  / 2 + 1.2 + col * (width  / windowColumns);
          const wy = -height / 2 + 2   + row * 3;

          if (face.axis === 'z') {
            win.position.set(
              x + wx,
              height / 2 + wy,
              z + face.sign * (depth / 2 + 0.05)
            );
            win.rotation.y = face.rot;
          } else {
            win.position.set(
              x + face.sign * (width / 2 + 0.05),
              height / 2 + wy,
              z + wx
            );
            win.rotation.y = face.rot;
          }

          scene.add(win);
        }
      }
      });
  }
}  