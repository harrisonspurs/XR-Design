import * as THREE from "three";

// Raycaster for checking if player is looking at objects
const crosshairRaycaster = new THREE.Raycaster();
const crosshairCenter = new THREE.Vector2(0, 0);
const raycastMeshesCache = new WeakMap();

function getRaycastMeshes(object) {
  let meshes = raycastMeshesCache.get(object);
  if (meshes) return meshes;

  meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.visible) meshes.push(child);
  });
  raycastMeshesCache.set(object, meshes);
  return meshes;
}

/**
 * Check if the camera is looking at a specific object
 * Used for interaction prompts (e.g., "Press E to sit")
 */
export function isLookingAt(camera, object, maxDistance = 4) {
  if (!object) return false;
  const maxDistanceSq = maxDistance * maxDistance;
  if (camera.position.distanceToSquared(object.position) > maxDistanceSq * 2.25) {
    return false;
  }

  const meshes = getRaycastMeshes(object);
  if (meshes.length === 0) return false;

  crosshairRaycaster.setFromCamera(crosshairCenter, camera);
  crosshairRaycaster.far = maxDistance;
  return crosshairRaycaster.intersectObjects(meshes, false).length > 0;
}