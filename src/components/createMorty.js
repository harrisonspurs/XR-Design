import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createMorty(scene, camera) {
  // Load Morty model in the garage
  const model = await loadModel(scene, "/models/morty_-_ready_for_ue4_rigged.glb", {
    position: { x: 3.00, y: -250.00, z: -0.00 },
    scale: 0.75,
    rotate: 0,
  });

  if (!model) {
    console.error("[Morty] Failed to load model");
    return { update: () => {}, interact: () => {}, isDialogOpen: () => false };
  }

  console.log("[Morty] Model loaded in garage at final position");

  // Set final rotation
  model.rotation.x = 0;
  model.rotation.y = 0.64;
  model.rotation.z = 0;

  // Add bright white light to illuminate Morty
  const mortyLight = new THREE.PointLight(0xffffff, 2, 30);
  mortyLight.position.set(model.position.x, model.position.y + 2, model.position.z - 3);
  scene.add(mortyLight);
  console.log("[Morty] Light added to illuminate model");

  // Prevent physics from affecting Morty
  model.userData.noPhysics = true;

  // Create interaction proxy
  model.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(model);
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

  // Dialog system
  let dialogOpen = false;
  let dialogUI = null;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;
  let dialogTimeout = null;
  let isAnimating = false;

  const dialogLines = [
    "I thought you were supposed to be meeting Rick at Joe's bar?",
    "Did you use his portal gun?!",
    "Oh no, this is bad!",
    "He's gonna be so mad at me!",
    "What were you thinking?!",
    "There is no way out from here, youre stuck with me in this garage forever!",
  ];

  function createDialogUI() {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      border: 2px solid #00ff00;
      padding: 15px 20px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 14px;
      max-width: 500px;
      z-index: 1000;
      line-height: 1.5;
    `;
    document.body.appendChild(dialog);
    return dialog;
  }

  function showDialog() {
    dialogOpen = true;

    if (!dialogUI) {
      dialogUI = createDialogUI();
    }

    // Show all dialog lines
    dialogUI.textContent = dialogLines.join("\n");
    dialogUI.style.display = "block";

    // Clear any existing timeout
    if (dialogTimeout) {
      clearTimeout(dialogTimeout);
    }

    // Auto-close dialog after 8 seconds
    dialogTimeout = setTimeout(() => {
      hideDialog();
    }, 8000);
  }

  function hideDialog() {
    dialogOpen = false;
    if (dialogUI) {
      dialogUI.style.display = "none";
    }
    if (dialogTimeout) {
      clearTimeout(dialogTimeout);
    }
  }

  function interact() {
    if (dialogOpen) {
      hideDialog();
    } else {
      showDialog();
    }
  }

  function isDialogOpen() {
    return dialogOpen;
  }

  let lastCheckTime = 0;

  function update() {
    const now = performance.now();
    const distance = camera.position.distanceTo(model.position);

    // Check if player is looking at Morty (throttled)
    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, interactionProxy, 5);
      lastLookCheckTime = now;
    }

    // Show interaction prompt if close and looking
    if (distance <= 8 && cachedIsLooking && !dialogOpen) {
      registerPrompt("morty", "Press E to talk to Morty", 3);
    } else if (!dialogOpen) {
      clearPrompt("morty");
    }
  }

  return { model, update, interact, isDialogOpen };
}
