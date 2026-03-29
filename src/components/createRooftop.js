import { loadModel } from "./modelLoader.js";
import * as THREE from "three";
import { ExtendedObject3D } from "@enable3d/ammo-physics";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export async function createRooftop(scene, physics = null) {

  await loadModel(scene, "/models/simple_short_crate.glb", {
    position: { x: 7, y: 9.4, z: -2.2 },
    scale: 0.45,
    rotate: 2.5,
  });

  if (physics) {
    return new Promise((resolve) => {
      loader.load("/models/stylized_house.glb", (gltf) => {
        const model = gltf.scene;
        
        model.position.set(0, -0.1, 0);
        model.rotation.y = Math.PI;
        
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // physics colliders for each mesh
        model.traverse((child) => {
          if (child.isMesh) {
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

        resolve(model);
      });
    });
  } else {
    return await loadModel(scene, "/models/stylized_house.glb", {
      position: { x: 0, y: -0.1, z: 0 },
      scale: 1,
      rotate: Math.PI,
    });
  }
}