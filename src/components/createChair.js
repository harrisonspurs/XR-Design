import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createChair(scene, camera) {

  const chair = await loadModel(scene, "/models/low-poly_lawn_chair.glb", {
    position: { x: 10.5, y: 9, z: -1 },
    scale: 0.6,
    rotate: Math.PI,
  });

  const SEATED_POSITION = { x: 10.5, y: 10.3, z: -1 };
  const STAND_POSITION  = { x: 10.5, y: 10.5, z: 1 };
  let isSeated = false;

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!chair) return;
    if (getActiveInteraction() !== "chair" && !isSeated) return;

    const distance = camera.position.distanceTo(chair.position);

    if (!isSeated && distance <= 3) {
      camera.position.set(SEATED_POSITION.x, SEATED_POSITION.y, SEATED_POSITION.z);
      isSeated = true;
      return;
    }

    if (isSeated) {
      camera.position.set(STAND_POSITION.x, STAND_POSITION.y, STAND_POSITION.z);
      isSeated = false;
    }
  });

  function update() {
    if (!chair) return;
    const distance = camera.position.distanceTo(chair.position);
    if ((distance <= 3 && isLookingAt(camera, chair, 3)) || isSeated) {
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