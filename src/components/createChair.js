import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createChair(scene, camera, playerController = null) {

  const chair = await loadModel(scene, "/models/low-poly_lawn_chair.glb", {
    position: { x: 10.5, y: 9, z: -1 },
    scale: 0.6,
    rotate: Math.PI,
  });

  const SEATED_POSITION = { x: 10.5, y: 10.3, z: -1 };
  const STAND_POSITION  = { x: 10.5, y: 10.5, z: 1 };
  let isSeated = false;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!chair) return;
    if (getActiveInteraction() !== "chair" && !isSeated) return;

    const distance = camera.position.distanceTo(chair.position);

    if (!isSeated && distance <= 3) {
      isSeated = true;
      if (playerController && playerController.sitDown) {
        playerController.sitDown(SEATED_POSITION);
      } else {
        camera.position.set(SEATED_POSITION.x, SEATED_POSITION.y, SEATED_POSITION.z);
      }
      return;
    }

    if (isSeated) {
      isSeated = false;
      if (playerController && playerController.standUp) {
        playerController.standUp(STAND_POSITION);
      } else {
        camera.position.set(STAND_POSITION.x, STAND_POSITION.y, STAND_POSITION.z);
      }
    }
  });

  function update() {
    if (!chair) return;
    const distance = camera.position.distanceTo(chair.position);

    const now = performance.now();
    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, chair, 3);
      lastLookCheckTime = now;
    }

    if ((distance <= 3 && cachedIsLooking) || isSeated) {
      registerPrompt("chair",
        isSeated ? "Press E to stand up" : "Press E to sit down",
        isSeated ? 10 : 2
      );
    } else {
      clearPrompt("chair");
    }
  }

  return { chair, update, getIsSeated: () => isSeated };
}