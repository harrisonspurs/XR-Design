import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ExtendedObject3D } from "@enable3d/ammo-physics";

const loader = new GLTFLoader();

let barModel = null;
let barLoaded = false;
let barCenter = { x: 5, y: -198, z: 0 };

export async function loadBar(scene, physics) {
  if (barLoaded) return barModel;

  return new Promise((resolve) => {
    loader.load("/models/bar_interior.glb", (gltf) => {
      barModel = gltf.scene;
      
      // scale down the bar to match player size
      barModel.scale.setScalar(1);
      
      // position bar below the house
      barModel.position.set(0, -200, 0);
      barModel.rotation.y = 0;

      barModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(barModel);

      // find bar bounds to get proper spawn point
      const box = new THREE.Box3().setFromObject(barModel);
      const center = box.getCenter(new THREE.Vector3());
      console.log("[createBar] Bar bounds:", box.min, box.max);
      console.log("[createBar] Bar center:", center);
      
      // store center for spawn point
      barCenter = { x: center.x, y: box.min.y + 2, z: center.z };

      // physics colliders
      barModel.traverse((child) => {
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

      barLoaded = true;
      resolve(barModel);
    });
  });
}

export function getBarSpawnPoint() {
  return barCenter;
}

export function isBarLoaded() {
  return barLoaded;
}
