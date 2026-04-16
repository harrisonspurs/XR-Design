import * as THREE from "three";

// Raycaster for checking what the player is looking at
const crosshairRaycaster = new THREE.Raycaster();
const crosshairCenter = new THREE.Vector2(0, 0); // Center of screen

// Helper function to get all visible meshes from an object
// This traverses the object tree and collects all mesh children
function getVisibleMeshes(object) {
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.visible) {
      meshes.push(child);
    }
  });
  return meshes;
}

// Check if the player is looking at an object within maxDistance
// Used for interaction detection (e.g., "Press E to sit in chair")
export function isLookingAt(camera, object, maxDistance = 4) {
  if (!object) return false;

  // First check: is the object close enough to even bother checking?
  const maxDistanceSq = maxDistance * maxDistance;
  if (camera.position.distanceToSquared(object.position) > maxDistanceSq * 2.25) {
    return false;
  }

  // Get all the meshes that make up this object
  const meshes = getVisibleMeshes(object);
  if (meshes.length === 0) return false;

  // Cast a ray from the camera through the center of the screen
  crosshairRaycaster.setFromCamera(crosshairCenter, camera);
  crosshairRaycaster.far = maxDistance;

  // Check if the ray hits any of the object's meshes
  const intersections = crosshairRaycaster.intersectObjects(meshes, false);
  return intersections.length > 0;
}