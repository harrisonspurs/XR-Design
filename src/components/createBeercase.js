import * as THREE from "three";
import { loadModel } from "./modelLoader.js";

export async function createBeercase(scene) {
  const BEER_CASE_POSITION = { x: 10.5, y: 0, z: -5 };
  const BEER_CASE_HEIGHT = 3;
  const BEER_CASE_ROTATION = 1.2;

  const beerCase = await loadModel(scene, "/models/detailed_beer_case.glb", {
    position: { x: 0, y: 0, z: 0 },
    scale: 10,
    rotate: BEER_CASE_ROTATION,
  });

  if (beerCase) {
    const box = new THREE.Box3().setFromObject(beerCase);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0) {
      const normalizedScale = BEER_CASE_HEIGHT / size.y;
      beerCase.scale.setScalar(normalizedScale);
      beerCase.updateMatrixWorld(true);
    }

    const adjustedBox = new THREE.Box3().setFromObject(beerCase);
    const center = adjustedBox.getCenter(new THREE.Vector3());
    const bottom = adjustedBox.min.y;
    beerCase.position.x += BEER_CASE_POSITION.x - center.x;
    beerCase.position.z += BEER_CASE_POSITION.z - center.z;
    beerCase.position.y += BEER_CASE_POSITION.y - bottom;
  }

  return beerCase;
}
