import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getBarSpawnPoint } from "./createBar.js";

const loader = new GLTFLoader();

export async function createJake(scene) {
  // Load Jake directly with GLTFLoader
  return new Promise((resolve) => {
    loader.load("/models/jake.glb", (gltf) => {
      const jake = gltf.scene;

      console.log("[createJake] Raw Jake object:", jake);
      console.log("[createJake] Jake children count:", jake.children.length);

      // Log all meshes and materials
      let meshCount = 0;
      jake.traverse((node) => {
        if (node.isMesh) {
          meshCount++;
          console.log(`[createJake] Mesh ${meshCount}:`, node.name, "Material:", node.material);
          console.log(`[createJake] Mesh ${meshCount} bounds:`, new THREE.Box3().setFromObject(node));

          // Force material to be visible
          if (node.material) {
            node.material.visible = true;
            node.material.transparent = false;
            node.material.opacity = 1;
            node.material.color.setHex(0x00ff00); // Make it bright green
          }
        }
      });
      console.log("[createJake] Total meshes found:", meshCount);

      // Scale Jake up
      jake.scale.multiplyScalar(5);

      // Position Jake at the bar
      const barSpawn = getBarSpawnPoint();
      console.log("[createJake] Bar spawn point:", barSpawn);
      jake.position.set(barSpawn.x + 3, barSpawn.y - 1, barSpawn.z - 5);
      jake.rotation.y = Math.PI * 0.5;

      console.log("[createJake] Jake final position:", jake.position);
      console.log("[createJake] Jake final scale:", jake.scale);

      // Add a visible debug marker at Jake's position
      const debugSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
      );
      debugSphere.position.copy(jake.position);
      scene.add(debugSphere);
      console.log("[createJake] Added magenta debug sphere at position");

      // Set up mesh properties
      jake.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(jake);
      console.log("[createJake] Jake added to scene");

      // Set up animation mixer
      let mixer = null;
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(jake);
        const animation = gltf.animations[0];
        const action = mixer.clipAction(animation);
        action.loop = THREE.LoopRepeat;
        action.play();
        console.log("[createJake] Playing animation:", animation.name);
      }

      // Update function to advance animation
      function update(delta) {
        if (mixer) {
          mixer.update(delta);
        }
      }

      resolve({ jake, update });
    });
  });
}
