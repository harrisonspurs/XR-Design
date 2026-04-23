import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { getBarSpawnPoint } from "./createBar.js";
import { registerPrompt, clearPrompt } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createRick(scene, physics, camera) {
  const barSpawn = getBarSpawnPoint();

  // Load pre-animated Rick model from Sketchfab
  const model = await loadModel(scene, "/models/rick.glb", {
    position: { x: 3.48, y: -199.91, z: -19.41 },
    scale: 0.4,
    rotate: 0,
  });

  console.log("[Rick] Model loaded at bar");

  // Set rotation to stand upright
  model.rotation.x = 0;
  model.rotation.y = 1.30;
  model.rotation.z = 0;

  // Prevent physics from affecting Rick (keep him where we position him)
  model.userData.noPhysics = true;

  // Create an invisible interaction proxy for raycasting (cheaper than using the model)
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
  let originalRotationY = model.rotation.y;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;
  let dialogTimeout = null;

  const dialogLines = [
    "Yo! You finally showed up!",
    "I'm too drunk now man...",
    "Can you go help me find my portal gun?",
    "I left it somewhere in Joe's bar.",
    "Go find it so we can get to the wild party!"
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
    originalRotationY = model.rotation.y;

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

    // Auto-close dialog after 7 seconds
    dialogTimeout = setTimeout(() => {
      hideDialog();
    }, 7000);
  }

  function hideDialog() {
    dialogOpen = false;
    if (dialogUI) {
      dialogUI.style.display = "none";
    }
    // Return to original rotation
    model.rotation.y = originalRotationY;

    // Clear timeout if dialog is closed early
    if (dialogTimeout) {
      clearTimeout(dialogTimeout);
      dialogTimeout = null;
    }
  }

  function interact() {
    console.log("[Rick] Interact called, dialog currently open:", dialogOpen);

    if (dialogOpen) {
      hideDialog();
    } else {
      showDialog();

      // Make Rick face the player
      const rickPos = model.position;
      const playerPos = camera.position;

      // Calculate angle to player
      const dx = playerPos.x - rickPos.x;
      const dz = playerPos.z - rickPos.z;
      const angle = Math.atan2(dx, dz);

      model.rotation.y = angle;
      console.log("[Rick] Facing player, angle:", angle);
    }
  }

  function update(delta) {
    // Update animation mixer
    if (model.mixer) {
      model.mixer.update(delta);
    }

    // Show interact prompt if looking at Rick and close
    if (camera) {
      const distance = camera.position.distanceTo(model.position);

      // Check if looking at Rick every 80ms
      const now = performance.now();
      if (now - lastLookCheckTime > 80) {
        cachedIsLooking = isLookingAt(camera, interactionProxy, 5);
        lastLookCheckTime = now;
      }

      // Show prompt only if close AND looking at Rick
      if (distance <= 5 && cachedIsLooking) {
        registerPrompt(
          "rick",
          window.__vrIsPresenting ?
            "Trigger/A to talk to Rick"
          : "Press E to talk to Rick",
          5,
        );
      } else {
        clearPrompt("rick");
      }
    }
  }

  return {
    model,
    update,
    interact,
    isDialogOpen: () => dialogOpen,
    getState: () => "idle",
  };
}
