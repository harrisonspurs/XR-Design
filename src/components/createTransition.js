import * as THREE from "three";
import "../styles/transitionOverlay.css";

// Store the overlay div so we only create it once
let overlay = null;
let isTransitioning = false;

// Get or create the overlay element for screen transitions
function getOverlay() {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "transition-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

// Fade the screen to black over a specified duration
export function fadeToBlack(duration = 500) {
  return new Promise((resolve) => {
    const el = getOverlay();
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "1";
    setTimeout(resolve, duration);
  });
}

// Fade the screen from black back to the scene
export function fadeFromBlack(duration = 500) {
  return new Promise((resolve) => {
    const el = getOverlay();
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = "0";
    setTimeout(resolve, duration);
  });
}

// Show text during the driving transition
export function showDrivingOverlay() {
  const el = getOverlay();
  const textDiv = document.createElement("div");
  textDiv.className = "transition-driving-text";
  textDiv.innerText = "Driving to Joe's Bar...";
  el.innerHTML = "";
  el.appendChild(textDiv);
}

// Clear any text from the overlay
export function clearOverlayText() {
  const el = getOverlay();
  el.innerHTML = "";
}

// Check if a transition is currently happening
export function isCurrentlyTransitioning() {
  return isTransitioning;
}

// Set the transition state (used to prevent interrupting transitions)
export function setTransitioning(val) {
  isTransitioning = val;
}
// Shake the camera to create a sense of impact during transitions
// This gives feedback when entering the car and driving
export function shakeCamera(camera, intensity = 0.02, duration = 2000) {
  const startTime = performance.now();
  const originalPos = camera.position.clone();

  // Animate the shake with random offset each frame
  function shake() {
    const elapsed = performance.now() - startTime;

    // Stop shaking after the specified duration
    if (elapsed > duration) {
      // Reset camera to original position when done
      camera.position.copy(originalPos);
      return;
    }

    // Add random movement to simulate camera shake
    // The intensity controls how much the camera moves
    const randomX = (Math.random() - 0.5) * intensity;
    const randomY = (Math.random() - 0.5) * intensity;

    camera.position.x = originalPos.x + randomX;
    camera.position.y = originalPos.y + randomY;

    requestAnimationFrame(shake);
  }

  shake();
}
