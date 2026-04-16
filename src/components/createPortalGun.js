import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import { getBarSpawnPoint } from "./createBar.js";

export async function createPortalGun(scene, camera, positionOverride = null) {
  // Load the portal gun model
  const portalGun = await loadModel(scene, "/models/portal_gun_rick_and_morty.glb", {
    position: { x: 0, y: 0, z: 0 },
    scale: 0.002,
    rotate: 0,
  });

  if (!portalGun) {
    return { update: () => {} };
  }

  // Position the portal gun - use override if provided, otherwise place in bar
  if (positionOverride) {
    portalGun.position.copy(positionOverride);
  } else {
    // Position directly in front of the bar spawn point (where player enters the bar)
    const barSpawn = getBarSpawnPoint();
    portalGun.position.set(barSpawn.x + 3, barSpawn.y - 0.88, barSpawn.z - 11);
    console.log("[createPortalGun] Bar spawn point:", barSpawn);
    console.log("[createPortalGun] Portal gun position:", portalGun.position);
  }
  portalGun.rotation.x = Math.PI / 1.6 ; // Rotate slightly for better viewing

  console.log("[createPortalGun] Portal gun loaded:", portalGun);
  console.log("[createPortalGun] Portal gun scale:", portalGun.scale);

  // Create an interaction proxy for raycasting
  portalGun.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(portalGun);
  const size = worldBox.getSize(new THREE.Vector3());
  const center = worldBox.getCenter(new THREE.Vector3());

  const proxyGeometry = new THREE.BoxGeometry(
    Math.max(size.x * 1.2, 0.5),
    Math.max(size.y * 1.2, 0.5),
    Math.max(size.z * 1.2, 0.5)
  );
  const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const interactionProxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
  interactionProxy.position.copy(center);
  scene.add(interactionProxy);

  let lastLookCheckTime = 0;
  let cachedIsLooking = false;

  function update() {
    const distance = camera.position.distanceTo(portalGun.position);
    const now = performance.now();

    // Check if player is looking at the gun (throttled to avoid performance issues)
    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, interactionProxy, 5);
      lastLookCheckTime = now;
    }

    // Show interaction prompt if close and looking at it
    if (distance <= 5 && cachedIsLooking) {
      registerPrompt("portalgun", "Press E to use portal gun", 3);
    } else {
      clearPrompt("portalgun");
    }
  }

  return { portalGun, update };
}
