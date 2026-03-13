// createHeadphones.js
// Headphones model the player can pick up.
// When worn, music plays in full stereo directly through the listener —
// simulating the feeling of putting headphones on.
// This is a great example of spatial audio design in XR.

import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt } from "./createPrompt.js";

export async function createHeadphones(scene, camera) {

  const headphones = await loadModel(scene, "/models/headphones.glb", {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotate: 0,
  });

  if (headphones) {
    const box = new THREE.Box3().setFromObject(headphones);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;
    headphones.position.x = 11 - center.x;
    headphones.position.z = -1 - center.z;
    headphones.position.y = 10.8 - bottom;
  }

  let isWearing = false;

  // Visual indicator that headphones are on
  const indicator = document.createElement("div");
  indicator.innerText = "🎧 Headphones on";
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    color: white;
    font-family: sans-serif;
    font-size: 14px;
    background: rgba(0,0,0,0.6);
    padding: 8px 16px;
    border-radius: 20px;
    pointer-events: none;
    display: none;
  `;
  document.body.appendChild(indicator);

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!headphones) return;

    const distance = camera.position.distanceTo(headphones.position);

    // Put on headphones
    if (!isWearing && distance <= 3) {
      isWearing = true;
      indicator.style.display = "block";

      // Hide the model — player is now wearing them
      headphones.visible = false;
      clearPrompt("headphones");
      return;
    }

    // Take off headphones
    if (isWearing) {
      isWearing = false;
      indicator.style.display = "none";
      headphones.visible = true;
    }
  });

  function update() {
    if (!headphones) return;
    if (isWearing) return;
    const distance = camera.position.distanceTo(headphones.position);
    if (distance <= 3) {
      registerPrompt("headphones", "Press E to put on headphones", 4);
    } else {
      clearPrompt("headphones");
    }
  }

  return { headphones, update, getIsWearing: () => isWearing };
}