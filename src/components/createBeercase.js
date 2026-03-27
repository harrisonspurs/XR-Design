import * as THREE from "three";
import { loadModel } from "./modelLoader.js";

export async function createBeercase(scene) {
  const beerCase = await loadModel(scene, "/models/detailed_beer_case.glb", {
    position: { x: 10.5, y: 20, z: -5 },
    scale: 1,
    rotate: 1.2,
  });

  if (beerCase) {
    // Normalize size and place the model with its base on the rooftop surface.
    const box = new THREE.Box3().setFromObject(beerCase);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0) {
      const targetHeight = 0.55;
      const normalizedScale = targetHeight / size.y;
      beerCase.scale.setScalar(normalizedScale);
      beerCase.updateMatrixWorld(true);
    }

    const adjustedBox = new THREE.Box3().setFromObject(beerCase);
    const center = adjustedBox.getCenter(new THREE.Vector3());
    const bottom = adjustedBox.min.y;
    beerCase.position.x += 10.5 - center.x;
    beerCase.position.z += -5 - center.z;
    beerCase.position.y += 20 - bottom;
  }

  return beerCase;
}
