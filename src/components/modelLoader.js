
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ExtendedObject3D } from "@enable3d/ammo-physics";

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


// Load a model with physics support (collision detection and physics bodies)
// This is more complex because we need to: scale, position, and add physics
export async function loadModelWithPhysics(
  loaderInstance,
  url,
  modelSize,
  position,
  scene,
  physics = null,
  options = {},
) {
  return new Promise((resolve, reject) => {
    const ANIMATION_PLAYBACK_RATE = 1.0;

    loaderInstance.load(url, (gltf) => {
      const model = gltf.scene;
      let mixer = null;
      let activeAction = null;
      let collider = null;

      // Calculate how big the model is and scale it appropriately
      let bounds = new THREE.Box3().setFromObject(model);
      let size = bounds.getSize(new THREE.Vector3());
      let center = bounds.getCenter(new THREE.Vector3());

      // Find the largest dimension of the model
      const maxAxis = Math.max(size.x, size.y, size.z);

      // Scale the model to the desired size
      if (maxAxis > 0) {
        const scaleFactor = modelSize / maxAxis;
        model.scale.multiplyScalar(scaleFactor);
        model.updateWorldMatrix(true, true);

        // Recalculate bounds after scaling
        bounds = new THREE.Box3().setFromObject(model);
        size = bounds.getSize(new THREE.Vector3());
        center = bounds.getCenter(new THREE.Vector3());
      }

      // Center the model geometry at origin
      model.position.sub(center);

      // Enable shadows on the model
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Get the base position for this model
      let basePos = new THREE.Vector3(0, 0, 0);
      if (position instanceof THREE.Vector3) {
        basePos.copy(position);
      } else if (position) {
        basePos.x = position.x || 0;
        basePos.y = position.y || 0;
        basePos.z = position.z || 0;
      }

      // Get optional offset for the collider (shifts where collision happens)
      let colliderOffset = new THREE.Vector3(0, 0, 0);
      if (options.colliderOffset) {
        if (options.colliderOffset instanceof THREE.Vector3) {
          colliderOffset.copy(options.colliderOffset);
        } else {
          colliderOffset.x = options.colliderOffset.x || 0;
          colliderOffset.y = options.colliderOffset.y || 0;
          colliderOffset.z = options.colliderOffset.z || 0;
        }
      }

      // Get optional offset for the visible model
      let modelOffset = new THREE.Vector3(0, 0, 0);
      if (options.modelOffset) {
        if (options.modelOffset instanceof THREE.Vector3) {
          modelOffset.copy(options.modelOffset);
        } else {
          modelOffset.x = options.modelOffset.x || 0;
          modelOffset.y = options.modelOffset.y || 0;
          modelOffset.z = options.modelOffset.z || 0;
        }
      }

      // Handle rotation if provided
      let finalQuat = new THREE.Quaternion();
      if (options.rotation) {
        let rotation = options.rotation;
        let euler;

        if (rotation instanceof THREE.Vector3) {
          euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
        } else {
          euler = new THREE.Euler(
            rotation.x || 0,
            rotation.y || 0,
            rotation.z || 0
          );
        }

        finalQuat.setFromEuler(euler);
      }

      model.quaternion.copy(finalQuat);

      // If physics is enabled, create a physics body for this model
      if (physics) {
        const mass = options.mass || 0;

        // Create a wrapper object to hold both the model and physics body
        const wrapper = new ExtendedObject3D();
        wrapper.position.set(
          basePos.x + colliderOffset.x,
          basePos.y + colliderOffset.y + (size.y || 1) / 2,
          basePos.z + colliderOffset.z
        );
        wrapper.quaternion.copy(finalQuat);

        // Position the model inside the wrapper
        model.position.set(0, -center.y, 0);
        // Apply offsets to the model
        model.position.x -= colliderOffset.x;
        model.position.y -= colliderOffset.y;
        model.position.z -= colliderOffset.z;
        model.position.add(modelOffset);

        wrapper.add(model);
        scene.add(wrapper);

        // Add physics to the wrapper
        physics.add.existing(wrapper, {
          shape: options.shape || "concave",
          width: size.x || 1,
          height: size.y || 1,
          depth: size.z || 1,
          mass: mass,
        });

        // If this is a static object (mass=0), set it to sleep
        if (mass === 0 && wrapper.body?.ammo) {
          wrapper.body.ammo.setActivationState(4);
        }

        collider = wrapper;
      } else {
        // No physics - just add the model to the scene
        model.position.add(basePos);
        model.position.add(modelOffset);
        scene.add(model);
      }

      // Handle animations if the model has them
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations[0];
        activeAction = mixer.clipAction(clip);
        activeAction.reset();
        activeAction.setEffectiveTimeScale(ANIMATION_PLAYBACK_RATE);
        activeAction.play();
      }

      console.log(`[modelLoader] Loaded with physics: ${url}`);
      resolve({
        model,
        mixer,
        activeAction,
        collider,
        clips: gltf.animations,
      });
    }, undefined, reject);
  });
}