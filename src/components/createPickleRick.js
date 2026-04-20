import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createPickleRick(scene, camera) {
  // Load Pickle Rick model in the garage
  const model = await loadModel(scene, "/models/pickle_rick_multiversus.glb", {
    position: { x: 5.40, y: -249.00, z: 5.00 },
    scale: 0.15,
    rotate: 0,
  });

  if (!model) {
    console.error("[PickleRick] Failed to load model");
    return { update: () => {}, model };
  }

  console.log("[PickleRick] Model loaded in garage at final position");

  // Set final rotation
  model.rotation.x = 0;
  model.rotation.y = 2.50;
  model.rotation.z = 0;

  // Setup animation mixer
  let mixer = null;
  let actions = [];
  let currentAction = null;

  // Check if model has animations
  if (model.animations && model.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    console.log(`[PickleRick] Found ${model.animations.length} animations:`, model.animations.map(a => a.name));

    // Create actions for all animations
    model.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      actions.push({ name: clip.name, action: action });
    });

    // Play first animation on loop
    if (actions.length > 0) {
      currentAction = actions[0].action;
      currentAction.play();
      console.log(`[PickleRick] Playing animation: ${actions[0].name}`);
    }
  } else {
    console.log("[PickleRick] No animations found on model");
  }

  // Add light to illuminate Pickle Rick
  const pickleLight = new THREE.PointLight(0xffffff, 2, 30);
  pickleLight.position.set(model.position.x, model.position.y + 2, model.position.z - 3);
  scene.add(pickleLight);

  function update(delta) {
    // Update animation mixer
    if (mixer) {
      mixer.update(delta);
    }
  }

  return { model, update };
}
