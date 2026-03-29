// modelLoader.js
// Reusable function for loading GLTF/GLB models into the scene.
// Handles positioning, scaling, shadow casting, and optional physics colliders.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ExtendedObject3D } from "@enable3d/ammo-physics";

const loader = new GLTFLoader();

/**
 * Load a model without physics (original simple API)
 */
export function loadModel(scene, path, options = {}) {
  const {
    position = { x: 0, y: 0, z: 0 },
    scale = 1,
    rotate = 0,
  } = options;

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

        model.position.set(position.x, position.y, position.z);
        model.scale.setScalar(scale);
        model.rotation.y = rotate;

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

/**
 * Load a model with physics collider support
 * @param {GLTFLoader} loaderInstance - GLTFLoader instance
 * @param {string} url - Path to model
 * @param {number} modelSize - Target size for largest axis
 * @param {THREE.Vector3|Object} position - World position
 * @param {THREE.Scene} scene - Scene to add model to
 * @param {AmmoPhysics|null} physics - Physics instance (null for no physics)
 * @param {Object} options - Additional options (mass, shape, colliderOffset, modelOffset, rotation)
 */
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

      // Compute the bounding box of the model
      let bounds = new THREE.Box3().setFromObject(model);
      let size = bounds.getSize(new THREE.Vector3());
      let center = bounds.getCenter(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z);

      // Uniformly scale the model so its largest axis matches modelSize
      if (maxAxis > 0) {
        const scaleFactor = modelSize / maxAxis;
        model.scale.multiplyScalar(scaleFactor);
        model.updateWorldMatrix(true, true);
        bounds = new THREE.Box3().setFromObject(model);
        size = bounds.getSize(new THREE.Vector3());
        center = bounds.getCenter(new THREE.Vector3());
      } else {
        model.updateWorldMatrix(true, true);
        bounds = new THREE.Box3().setFromObject(model);
        size = bounds.getSize(new THREE.Vector3());
        center = bounds.getCenter(new THREE.Vector3());
      }

      // Center model geometry at origin (so collider wraps it)
      model.position.sub(center);

      // Enable shadows
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Compute base world position from caller
      const basePos = new THREE.Vector3(0, 0, 0);
      if (position instanceof THREE.Vector3) {
        basePos.copy(position);
      } else if (position) {
        basePos.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
      }

      // Compute optional offsets
      const colliderOff =
        options.colliderOffset ?
          options.colliderOffset instanceof THREE.Vector3 ?
            options.colliderOffset
          : new THREE.Vector3(
              options.colliderOffset.x || 0,
              options.colliderOffset.y || 0,
              options.colliderOffset.z || 0,
            )
        : new THREE.Vector3();

      const modelOff =
        options.modelOffset ?
          options.modelOffset instanceof THREE.Vector3 ?
            options.modelOffset
          : new THREE.Vector3(
              options.modelOffset.x || 0,
              options.modelOffset.y || 0,
              options.modelOffset.z || 0,
            )
        : new THREE.Vector3();

      const colliderPosition = basePos.clone().add(colliderOff);

      // Apply rotation
      let finalQuat = new THREE.Quaternion();
      if (options.rotation) {
        const r =
          options.rotation instanceof THREE.Vector3 ?
            new THREE.Euler(
              options.rotation.x,
              options.rotation.y,
              options.rotation.z,
            )
          : new THREE.Euler(
              options.rotation.x || 0,
              options.rotation.y || 0,
              options.rotation.z || 0,
            );
        finalQuat.setFromEuler(r);
      }
      model.quaternion.copy(finalQuat);

      if (physics) {
        const mass = typeof options.mass === "number" ? options.mass : 0;
        const wrapper = new ExtendedObject3D();
        
        // Position wrapper so its bottom sits at the desired baseY
        wrapper.position.set(
          colliderPosition.x,
          colliderPosition.y + (size.y || 1) / 2,
          colliderPosition.z,
        );
        if (finalQuat) wrapper.quaternion.copy(finalQuat);

        // Centre model geometry inside wrapper
        model.position.set(0, -center.y, 0);
        model.position.add(colliderOff.clone().negate());
        model.position.add(modelOff);
        wrapper.add(model);

        scene.add(wrapper);

        physics.add.existing(wrapper, {
          shape: options.shape || "concave",
          width: size.x || 1,
          height: size.y || 1,
          depth: size.z || 1,
          mass,
        });

        // Freeze static bodies (mass=0) to improve physics performance
        if (mass === 0 && wrapper.body?.ammo) {
          wrapper.body.ammo.setActivationState(4);
        }

        collider = wrapper;
      } else {
        // Place model at requested world position plus any modelOffset
        const worldPos = basePos.clone().add(modelOff);
        model.position.add(worldPos);
        scene.add(model);
      }

      // Handle animations
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations[0];
        activeAction = mixer.clipAction(clip);
        activeAction.reset();
        activeAction.setEffectiveTimeScale(ANIMATION_PLAYBACK_RATE);
        activeAction.play();
      }

      console.log(`[modelLoader] Loaded with physics: ${url}`);
      resolve({ model, mixer, activeAction, collider, clips: gltf.animations });
    }, undefined, reject);
  });
}