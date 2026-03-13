// createEnvironment.js
// Sets up the environment for the XR Rooftop scene.
// Uses a custom gradient sky instead of an HDR to match the cartoon aesthetic.
// A gradient sky gives full control over mood and colour, and fits a stylised
// cartoon world far better than a photorealistic HDR panorama.

import * as THREE from "three";

export async function createEnvironment(scene, renderer) {

  // ── Gradient Sky ──────────────────────────────────────────────────────────

  // We create the gradient sky using a large sphere around the scene.
  // The inside of the sphere is painted with a vertical colour gradient
  // going from deep purple/blue at the top down to warm orange/pink at the horizon.
  // This mimics a stylised cartoon sunset sky.

  const skyGeo = new THREE.SphereGeometry(450, 32, 32);

  // We use vertex colours to paint the gradient directly onto the sphere geometry.
  // Each vertex gets a colour based on its Y position (height).
  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide, // render the inside of the sphere, not the outside
  });

  // Define our sunset gradient colours
  const topColour = new THREE.Color(0x1a0533);      // deep purple at the top
  const midColour = new THREE.Color(0xff6b35);      // warm orange in the middle
  const horizonColour = new THREE.Color(0xff9d7a);  // soft pink/peach at horizon

  // Apply colours to each vertex based on height (Y position)
  const positions = skyGeo.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);

    // Normalise Y between 0 and 1 (0 = bottom, 1 = top of sphere)
    const t = (y + 450) / 900;

    let colour = new THREE.Color();

    if (t > 0.5) {
      // Upper half — blend from orange to deep purple
      colour.lerpColors(midColour, topColour, (t - 0.5) * 2);
    } else {
      // Lower half — blend from peach/pink to orange
      colour.lerpColors(horizonColour, midColour, t * 2);
    }

    colors.push(colour.r, colour.g, colour.b);
  }

  skyGeo.setAttribute("color", new THREE.BufferAttribute(
    new Float32Array(colors), 3
  ));

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.fog = new THREE.FogExp2(0xff6b35, 0.005);

  // ── Ground Plane ─────────────────────────────────────────────────────────

// ── Ground Plane ─────────────────────────────────────────────────────────

  // Flat solid colour floor — no texture needed for a cartoon aesthetic.
  // A dark grey/charcoal colour reads instantly as a rooftop in a stylised world.
  const floorGeometry = new THREE.PlaneGeometry(500, 500);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, // dark charcoal grey — classic cartoon rooftop colour
    roughness: 0.9,
    metalness: 0,
  });

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  
  // ── Lighting ─────────────────────────────────────────────────────────────

  // Ambient light gives a warm base illumination across the whole scene
  // matching the sunset colour palette
  const ambientLight = new THREE.AmbientLight(0xff9966, 1.5);
  scene.add(ambientLight);

  // Directional light acts as the setting sun — low angle, warm colour
  const sunLight = new THREE.DirectionalLight(0xff7733, 3);
  sunLight.position.set(-50, 40, -50); // low on the horizon
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // A subtle purple/blue fill light from the opposite side
  // simulates the cool sky light contrasting with the warm sun
  const fillLight = new THREE.DirectionalLight(0x9966ff, 0.5);
  fillLight.position.set(50, 30, 50);
  scene.add(fillLight);

  return { floor, sunLight };
}