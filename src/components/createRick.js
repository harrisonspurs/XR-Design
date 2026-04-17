import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { getBarSpawnPoint } from "./createBar.js";

export async function createRick(scene, physics) {
  const barSpawn = getBarSpawnPoint();

  // Load Rick
  const model = await loadModel(scene, "/models/ricksanchez.glb", {
    position: { x: barSpawn.x + 2.2, y: barSpawn.y - 2, z: barSpawn.z - 7 },
    scale: 0.8,
    rotate: 0,
  });

  // Set rotation to face us properly
  model.rotation.x = 4.67;
  model.rotation.y = -0.05;
  model.rotation.z = 0;

  console.log(`[Rick] Loaded at bar`);

  // Arrow key controls for movement
  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "ArrowLeft":
        model.position.x -= 0.2;
        break;
      case "ArrowRight":
        model.position.x += 0.2;
        break;
      case "ArrowUp":
        model.position.z += 0.2;
        break;
      case "ArrowDown":
        model.position.z -= 0.2;
        break;
    }
  });

  function update(delta) {
    // Placeholder for animations later
  }

  return {
    model,
    update,
    getState: () => "idle",
  };
}
