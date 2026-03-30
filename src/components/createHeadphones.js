import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createHeadphones(scene, camera) {
  const headphones = await loadModel(scene, "/models/headphones_free.glb", {
    position: { x: -1, y: 1.15, z: 2.8 },
    scale: 0.01,
    rotate: Math.PI * 0.45,
  });

  if (headphones) {
    const box = new THREE.Box3().setFromObject(headphones);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;
    headphones.position.x = 10.9 - center.x;
    headphones.position.z = -0.7 - center.z;
    headphones.position.y = 10.5 - bottom;
  }

  let isWearing = false;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;

  const indicator = document.createElement("div");
  indicator.innerText = "Headphones on (H to remove)";
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

  function wearHeadphones() {
    if (!headphones || isWearing) return;
    isWearing = true;
    indicator.style.display = "block";
    headphones.visible = false;
    clearPrompt("headphones");
  }

  function removeHeadphones() {
    if (!headphones || !isWearing) return;
    isWearing = false;
    indicator.style.display = "none";
    headphones.visible = true;
  }

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "KeyH") return;
    removeHeadphones();
  });

  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (!headphones || isWearing) return;

    const active = getActiveInteraction();
    if (active !== "headphones") return;

    const distance = camera.position.distanceTo(headphones.position);
    if (distance > 2.8) return;
    if (!cachedIsLooking) return;

    wearHeadphones();
  });

  function update() {
    if (!headphones) return;
    if (isWearing) {
      clearPrompt("headphones");
      return;
    }

    const distance = camera.position.distanceTo(headphones.position);
    const now = performance.now();

    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, headphones, 3.2);
      lastLookCheckTime = now;
    }

    if (distance <= 2.8 && cachedIsLooking) {
      registerPrompt("headphones", "Click to wear headphones", 5);
    } else {
      clearPrompt("headphones");
    }
  }

  return { headphones, update, getIsWearing: () => isWearing };
}