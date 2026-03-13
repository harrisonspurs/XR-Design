// modelLoader.js
// Reusable function for loading GLTF/GLB models into the scene.
// Handles positioning, scaling, and shadow casting automatically.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

export function loadModel(scene, path, options = {}) {

  // Default options — can be overridden when calling loadModel()
  const {
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    rotate = 0, // rotation around Y axis in radians
  } = options;

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

        // Set position, scale and rotation from options
        model.position.set(position.x, position.y, position.z);
        model.scale.setScalar(scale);
        model.rotation.y = rotate;

        // Enable shadows on every mesh inside the model
        // traverse() walks through every child object in the model
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // Log the bounding box so we can find the true size and position

        console.log(`[modelLoader] Loaded: ${path}`);
        resolve(model);
      },
      // Progress callback — logs loading percentage to console
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        console.log(`[modelLoader] Loading ${path}: ${percent}%`);
      },
      // Error callback
      (error) => {
        console.error(`[modelLoader] Failed to load: ${path}`, error);
        reject(error);
      }
    );
  });
}