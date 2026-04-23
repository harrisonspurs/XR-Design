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
    // Position the portal gun at the saved location in the bar
    portalGun.position.set(4.48, -197.00, -34.41);
  }
  portalGun.rotation.x = 1.96;
  portalGun.rotation.z = 0.60;

  console.log("[createPortalGun] Portal gun loaded at bar");
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
  let isPickedUp = false;
  let onUseCallback = null;

  // Create audio for portal gun
  const portalGunSound = new Audio("/audio/portal-gun-sound-effect.mp3");
  portalGunSound.volume = 0.7;

  // Create UI for when portal gun is picked up
  const pickupUI = document.createElement("div");
  pickupUI.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: black;
    color: white;
    border: 1px solid #666;
    padding: 10px 15px;
    font-family: monospace;
    font-size: 14px;
    border-radius: 5px;
    display: none;
    z-index: 100;
  `;
  pickupUI.textContent = "Portal Gun equipped";
  document.body.appendChild(pickupUI);

  function showPickupHint(message, duration = 2200) {
    pickupUI.textContent = message;
    pickupUI.style.display = "block";
    window.setTimeout(() => {
      pickupUI.style.display = "none";
    }, duration);
  }

  // E key listener for picking up the portal gun
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyE" && !isPickedUp && distance <= 5 && cachedIsLooking) {
      isPickedUp = true;
      portalGun.visible = false;
      showPickupHint(
        window.__vrIsPresenting ?
          "Portal Gun equipped - trigger/A to fire"
        : "Portal Gun equipped - press R to fire",
      );
      clearPrompt("portalgun");
    }
  });

  // R key listener for using the portal gun
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyR" && isPickedUp) {
      console.log("[Portal Gun] Rick used the Portal Gun!");
      portalGunSound.currentTime = 0;
      portalGunSound.play();
      if (onUseCallback) {
        onUseCallback();
      }
    }
  });

  let distance = 0;

  function update() {
    distance = camera.position.distanceTo(portalGun.position);
    const now = performance.now();

    // Check if player is looking at the gun (throttled to avoid performance issues)
    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, interactionProxy, 5);
      lastLookCheckTime = now;
    }

    // Show interaction prompt if close, looking at it, and not picked up yet
    if (distance <= 5 && cachedIsLooking && !isPickedUp) {
      registerPrompt(
        "portalgun",
        window.__vrIsPresenting ?
          "Trigger/A to pick up Rick's Portal Gun"
        : "Press E to pick up Rick's Portal Gun",
        3,
      );
    } else {
      clearPrompt("portalgun");
    }
  }

  return { portalGun, update, setOnUse: (callback) => { onUseCallback = callback; } };
}
