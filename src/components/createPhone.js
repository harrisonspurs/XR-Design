
import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";

export async function createPhone(scene, camera, boomboxController) {
  const phone = await loadModel(scene, "/models/ipod_scroll_wheel.glb", {
    position: {  x:1.37, y: 0.6, z: 1.3 },
    scale: 0.0022,
    rotate: Math.PI * 1.80,
  });

  if (phone) {
    const box = new THREE.Box3().setFromObject(phone);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;

    phone.position.x = 8.9 - center.x;
    phone.position.z = -1.35 - center.z;
    phone.position.y = 10.5 - bottom;
    phone.rotation.x = Math.PI * 0.02;
    phone.rotation.z = Math.PI * 0.08;
  }
  let proxy = null;
  if (phone) {
    const box = new THREE.Box3().setFromObject(phone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    proxy = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(size.x * 1.3, 0.18),
        Math.max(size.y * 1.6, 0.18),
        Math.max(size.z * 2.3, 0.18)
      ),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.position.copy(center);
    scene.add(proxy);
  }
  let uiOpen = false;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;
  const ui = document.createElement("div");
  ui.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    background: rgba(7,7,7,0.94);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 18px;
    padding: 20px;
    color: white;
    font-family: sans-serif;
    display: none;
    z-index: 120;
    text-align: center;
  `;
  document.body.appendChild(ui);

  const title = document.createElement("div");
  title.innerText = "IPOD PLAYER";
  title.style.cssText = `
    font-size: 13px;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.55);
    margin-bottom: 12px;
  `;
  ui.appendChild(title);

  const trackLabel = document.createElement("div");
  trackLabel.style.cssText = `
    font-size: 14px;
    margin-bottom: 14px;
    min-height: 34px;
  `;
  ui.appendChild(trackLabel);

  const playBtn = document.createElement("button");
  playBtn.innerText = "Play / Pause";
  playBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    background: rgba(255,120,40,0.9);
    color: white;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 10px;
  `;
  ui.appendChild(playBtn);

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "Close";
  closeBtn.style.cssText = `
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: rgba(255,255,255,0.12);
    color: white;
    font-size: 13px;
  `;
  ui.appendChild(closeBtn);

  function refreshLabel() {
    const track = boomboxController.getCurrentTrack?.();
    if (!track) {
      trackLabel.innerText = "No record selected";
      return;
    }

    const state = boomboxController.getIsPlaying?.() ? "Now Playing" : "Ready";
    trackLabel.innerText = `${state}: ${track.title} - ${track.artist}`;
  }

  function openUI() {
    refreshLabel();
    ui.style.display = "block";
    uiOpen = true;
    document.exitPointerLock();
  }

  function closeUI() {
    ui.style.display = "none";
    uiOpen = false;
  }

  closeBtn.addEventListener("click", closeUI);

  playBtn.addEventListener("click", () => {
    boomboxController.togglePlayback?.();
    setTimeout(refreshLabel, 80);
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && uiOpen) {
      closeUI();
      return;
    }

    if (e.code !== "KeyE") return;
    if (!phone) return;

    const active = getActiveInteraction();
    if (active !== "phone" && !uiOpen) return;

    const distance = camera.position.distanceTo(phone.position);
    if (distance > 3.2 && !uiOpen) return;

    uiOpen ? closeUI() : openUI();
  });
  function update() {
    if (!phone) return;

    const distance = camera.position.distanceTo(phone.position);
    const now = performance.now();

    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = proxy
        ? isLookingAt(camera, proxy, 3.5)
        : isLookingAt(camera, phone, 3.2);
      lastLookCheckTime = now;
    }

    if (!uiOpen && distance <= 3.2 && cachedIsLooking) {
      registerPrompt("phone", "Press E to open iPod player", 4);
    } else {
      clearPrompt("phone");
    }
  }

  return { phone, update };
}
