import { loadModel } from "./modelLoader.js";

export async function createRooftop(scene) {

  await loadModel(scene, "/models/stylized_house.glb", {
    position: { x: 0, y: -0.1, z: 0 },
    scale: 1,
    rotate: Math.PI,
  });

  await loadModel(scene, "/models/simple_short_crate.glb", {
    position: { x: 7, y: 9.4, z: -2.2 },
    scale: 0.45,
    rotate: 2.5,
  });

}