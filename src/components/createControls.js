import * as THREE from "three";

const crosshairRaycaster = new THREE.Raycaster();
const crosshairCenter = new THREE.Vector2(0, 0);
const vrRayOrigin = new THREE.Vector3();
const vrRayDirection = new THREE.Vector3();

function getVisibleMeshes(object) {
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.visible) {
      meshes.push(child);
    }
  });
  return meshes;
}

export function isLookingAt(camera, object, maxDistance = 4) {
  if (!object) return false;
  const vrRay = getVRLookRay();
  const origin = vrRay ? vrRay.origin : camera.position;

  const maxDistanceSq = maxDistance * maxDistance;
  if (origin.distanceToSquared(object.position) > maxDistanceSq * 2.25) {
    return false;
  }

  const meshes = getVisibleMeshes(object);
  if (meshes.length === 0) return false;

  if (vrRay) {
    crosshairRaycaster.set(vrRay.origin, vrRay.direction);
  } else {
    crosshairRaycaster.setFromCamera(crosshairCenter, camera);
  }
  crosshairRaycaster.far = maxDistance;

  const intersections = crosshairRaycaster.intersectObjects(meshes, false);
  return intersections.length > 0;
}

function getVRLookRay() {
  const ray = window.__vrLookRay;
  if (!window.__vrIsPresenting || !ray?.origin || !ray?.direction) return null;

  vrRayOrigin.set(ray.origin.x, ray.origin.y, ray.origin.z);
  vrRayDirection.set(ray.direction.x, ray.direction.y, ray.direction.z);
  if (vrRayDirection.lengthSq() === 0) return null;
  vrRayDirection.normalize();
  return { origin: vrRayOrigin, direction: vrRayDirection };
}
