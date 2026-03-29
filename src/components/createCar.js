import * as THREE from "three";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import { 
  fadeToBlack, 
  fadeFromBlack, 
  showDrivingOverlay, 
  clearOverlayText,
  shakeCamera,
  isCurrentlyTransitioning,
  setTransitioning 
} from "./createTransition.js";

// audio
let engineSound = null;

function playEngineSound() {
  if (!engineSound) {
    engineSound = new Audio("/audio/car_engine.mp3");
    engineSound.volume = 0.6;
  }
  engineSound.currentTime = 0;
  engineSound.play().catch(() => {});
}

function stopEngineSound() {
  if (engineSound) {
    engineSound.pause();
    engineSound.currentTime = 0;
  }
}

export function createCar(houseModel, camera, playerController, onArriveAtBar) {
  
  const carMeshes = [];
  houseModel.traverse((child) => {
    if (child.isMesh && child.name.includes("car_LP_Car")) {
      carMeshes.push(child);
    }
  });

  if (carMeshes.length === 0) {
    console.warn("[createCar] No car meshes found");
    return { update: () => {} };
  }

  const carBase = carMeshes.find(m => m.name.includes("Base")) || carMeshes[0];
  
  const carWorldPos = new THREE.Vector3();
  carBase.getWorldPosition(carWorldPos);

  let lastLookCheck = 0;
  let isLooking = false;

  document.addEventListener("keydown", async (e) => {
    if (e.code !== "KeyE") return;
    if (isCurrentlyTransitioning()) return;
    if (getActiveInteraction() !== "car") return;

    const dist = camera.position.distanceTo(carWorldPos);
    if (dist > 5) return;

    setTransitioning(true);
    clearPrompt("car");

    const seatPos = carWorldPos.clone();
    seatPos.y += 1.5;

    if (playerController.sitDown) {
      playerController.sitDown(seatPos);
    }

    // engine sound
    playEngineSound();

    await new Promise(r => setTimeout(r, 300));
    
    shakeCamera(camera, 0.015, 2500);
    
    await fadeToBlack(800);
    showDrivingOverlay();

    await new Promise(r => setTimeout(r, 2000));

    stopEngineSound();
    clearOverlayText();
    
    if (onArriveAtBar) {
      await onArriveAtBar();
    }

    await fadeFromBlack(800);
    setTransitioning(false);
  });

  function update() {
    if (isCurrentlyTransitioning()) return;

    const dist = camera.position.distanceTo(carWorldPos);
    
    const now = performance.now();
    if (now - lastLookCheck > 100) {
      isLooking = carMeshes.some(mesh => isLookingAt(camera, mesh, 5));
      lastLookCheck = now;
    }

    if (dist <= 5 && isLooking) {
      registerPrompt("car", "Press E to drive to Joe's Bar", 3);
    } else {
      clearPrompt("car");
    }
  }

  return { update, carMeshes };
}
