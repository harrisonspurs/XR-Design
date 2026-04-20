
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

// Simple model loader - loads a GLTF file and positions it in the scene
// Using GLTFLoader from THREE.js examples
export function loadModel(scene, path, options = {}) {
  const position = options.position || { x: 0, y: 0, z: 0 };
  const scale = options.scale || 1;
  const rotate = options.rotate || 0;

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

        // Position and scale the model
        model.position.set(position.x, position.y, position.z);
        model.scale.setScalar(scale);
        model.rotation.y = rotate;

        // Enable shadows on all mesh parts of the model
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // Set up animation if available
        let mixer = null;
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const clip = gltf.animations[0];
          const action = mixer.clipAction(clip);
          action.play();
        }

        // Attach mixer to model so it can be accessed by components
        model.mixer = mixer;
        model.animations = gltf.animations || [];

        console.log(`[modelLoader] Loaded: ${path}`);
        resolve(model);
      },
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[modelLoader] Loading ${path}: ${percent}%`);
      },
      (error) => {
        console.error(`[modelLoader] Failed to load: ${path}`, error);
        reject(error);
      }
    );
  });
}
