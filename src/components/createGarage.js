import { loadModel } from "./modelLoader.js";
import { createMorty } from "./createMorty.js";
import { createPickleRick } from "./createPickleRick.js";
import * as THREE from "three";
import { ExtendedObject3D } from "@enable3d/ammo-physics";

export async function createGarage(scene, camera, playerController, physics) {
  // Load the garage model
  const garage = await loadModel(scene, "/models/rick_and_morty_garage_fan_art.glb", {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotate: 0,
  });

  if (!garage) {
    console.error("[createGarage] Failed to load garage model");
    return { garage, update: () => {} };
  }

  // Position the garage closer, similar to bar but not as far
  garage.position.set(5, -250, 0);
  console.log("[createGarage] Garage positioned at:", garage.position);

  // Add physics bodies to all meshes in the garage
  garage.traverse((child) => {
    if (child.isMesh && physics) {
      const wrapper = new ExtendedObject3D();
      wrapper.position.copy(child.getWorldPosition(new THREE.Vector3()));
      wrapper.quaternion.copy(child.getWorldQuaternion(new THREE.Quaternion()));
      wrapper.scale.copy(child.getWorldScale(new THREE.Vector3()));

      const geo = child.geometry.clone();
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
      wrapper.add(mesh);

      scene.add(wrapper);

      physics.add.existing(wrapper, {
        shape: "concave",
        mass: 0,
      });

      if (wrapper.body?.ammo) {
        wrapper.body.ammo.setActivationState(4);
      }
    }
  });

  // Calculate spawn point inside the garage (centered, not outside)
  garage.updateMatrixWorld(true);
  const garageBox = new THREE.Box3().setFromObject(garage);
  const garageCenter = garageBox.getCenter(new THREE.Vector3());

  const garageSpawnPoint = {
    x: garageCenter.x,
    y: garageBox.min.y + 3,
    z: garageCenter.z,
  };

  console.log("[createGarage] Garage loaded successfully");
  console.log("[createGarage] Garage bounds:", garageBox.min, garageBox.max);
  console.log("[createGarage] Garage spawn point:", garageSpawnPoint);

  // Spawn player inside the garage at a safe position
  if (playerController) {
    playerController.standUp(garageSpawnPoint);
    console.log("[createGarage] Player spawned at:", garageSpawnPoint);
  }

  // Create Morty in the garage
  const morty = await createMorty(scene, camera);
  console.log("[createGarage] Morty created in garage");

  // Create Pickle Rick in the garage
  const pickleRick = await createPickleRick(scene, camera);
  console.log("[createGarage] Pickle Rick created in garage");

  function update(delta) {
    morty.update();
    pickleRick.update(delta);
  }

  return { garage, update, morty, pickleRick };
}
