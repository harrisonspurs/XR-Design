import * as THREE from "three";

let overlay = null;
let isTransitioning = false;

function getOverlay() {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: black;
      opacity: 0;
      pointer-events: none;
      z-index: 1000;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function fadeToBlack(duration = 500) {
  return new Promise((resolve) => {
    const el = getOverlay();
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "1";
    setTimeout(resolve, duration);
  });
}

export function fadeFromBlack(duration = 500) {
  return new Promise((resolve) => {
    const el = getOverlay();
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "0";
    setTimeout(resolve, duration);
  });
}

export function showDrivingOverlay() {
  const el = getOverlay();
  el.innerHTML = `
    <div style="
      position: absolute;
      bottom: 30%;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-family: sans-serif;
      font-size: 18px;
      opacity: 0.8;
    ">Driving to Joe's Bar...</div>
  `;
}

export function clearOverlayText() {
  const el = getOverlay();
  el.innerHTML = "";
}

export function isCurrentlyTransitioning() {
  return isTransitioning;
}

export function setTransitioning(val) {
  isTransitioning = val;
}
export function shakeCamera(camera, intensity = 0.02, duration = 2000) {
  const startTime = performance.now();
  const originalPos = camera.position.clone();
  
  function shake() {
    const elapsed = performance.now() - startTime;
    if (elapsed > duration) {
      return;
    }
    
    camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
    camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity;
    
    requestAnimationFrame(shake);
  }
  
  shake();
}
