// createControls.js
// First-person WASD movement with sprint, jump, gravity and teleportation.
// Gravity keeps the player grounded on whichever surface they're standing on.
// Teleportation between levels is a standard WebXR locomotion pattern —
// it avoids motion sickness while allowing vertical navigation.

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

export function createControls(camera, renderer, getIsSeated = () => false) {

  const controls = new PointerLockControls(camera, renderer.domElement);

  // Lock pointer on click
  renderer.domElement.addEventListener("click", () => {
    controls.lock();
  });

  // ── Movement Keys ─────────────────────────────────────────────────────────
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false,
  };

  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW": keys.w = true; break;
      case "KeyA": keys.a = true; break;
      case "KeyS": keys.s = true; break;
      case "KeyD": keys.d = true; break;
      case "ShiftLeft": keys.shift = true; break;
      case "Space": keys.space = true; break;
      // T key teleports between rooftop and ground level
      case "KeyT": teleport(); break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW": keys.w = false; break;
      case "KeyA": keys.a = false; break;
      case "KeyS": keys.s = false; break;
      case "KeyD": keys.d = false; break;
      case "ShiftLeft": keys.shift = false; break;
      case "Space": keys.space = false; break;
    }
  });

  // ── Level Definitions ─────────────────────────────────────────────────────

  // Define the two levels the player can exist on.
  // Y values match the camera height we set in createScene.js
  const levels = {
    rooftop: { x: 9, y: 10.5, z: 1 },
    ground:  { x: 9, y: 1.7,  z: 8 },
  };

  // Track which level the player is currently on
  let currentLevel = "rooftop";

  // Teleport snaps the camera instantly to the other level.
  // This is the standard WebXR teleportation pattern — smooth locomotion
  // causes motion sickness in VR, so instant teleportation is preferred.
  function teleport() {
    if (currentLevel === "rooftop") {
      camera.position.set(levels.ground.x, levels.ground.y, levels.ground.z);
      currentLevel = "ground";
      updateHint();
    } else {
      camera.position.set(levels.rooftop.x, levels.rooftop.y, levels.rooftop.z);
      currentLevel = "rooftop";
      updateHint();
    }
  }

  // ── Simple Gravity ────────────────────────────────────────────────────────

  // Vertical velocity — increases downward when player is airborne
  let velocityY = 0;

  // Track whether the player is currently airborne
  let isJumping = false;

  // Ground levels — the Y height of each walkable surface
  const ROOFTOP_HEIGHT = 10.5;
  const GROUND_HEIGHT  = 1.7;

  // Gravity strength — how fast the player falls
  const GRAVITY = 0.008;

  function applyGravity() {
    // Apply downward acceleration
    velocityY -= GRAVITY;
    camera.position.y += velocityY;

    // Check if player has landed on the rooftop
    if (camera.position.y <= ROOFTOP_HEIGHT &&
        camera.position.x > 5 && camera.position.x < 13 &&
        camera.position.z > -4 && camera.position.z < 6) {
      camera.position.y = ROOFTOP_HEIGHT;
      velocityY = 0;
      isJumping = false;
      currentLevel = "rooftop";
      updateHint();
    }

    // Check if player has landed on the ground
    if (camera.position.y <= GROUND_HEIGHT) {
      camera.position.y = GROUND_HEIGHT;
      velocityY = 0;
      isJumping = false;
      currentLevel = "ground";
      updateHint();
    }
  }

  // ── Movement Speed ────────────────────────────────────────────────────────
  const walkSpeed = 0.08;
  const sprintSpeed = 0.18;

  function update() {
    if (!controls.isLocked) return;

    // Block all movement while player is seated
    if (getIsSeated()) return;

    const speed = keys.shift ? sprintSpeed : walkSpeed;

    if (keys.w) controls.moveForward(speed);
    if (keys.s) controls.moveForward(-speed);
    if (keys.a) controls.moveRight(-speed);
    if (keys.d) controls.moveRight(speed);

    if (keys.space && !isJumping) {
      velocityY = 0.15;
      isJumping = true;
    }

    applyGravity();
  }

  // ── UI Hints ──────────────────────────────────────────────────────────────
  const hint = document.createElement("div");
  hint.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-family: sans-serif;
    font-size: 14px;
    background: rgba(0,0,0,0.6);
    padding: 10px 20px;
    border-radius: 20px;
    pointer-events: none;
    text-align: center;
    line-height: 1.6;
  `;
  document.body.appendChild(hint);

  function updateHint() {
    if (currentLevel === "rooftop") {
      hint.innerText = "WASD — move   |   Shift — sprint   |   Space — jump   |   T — ground   |   Walk off edge to fall";
    } else {
      hint.innerText = "WASD — move   |   Shift — sprint   |   Space — jump   |   T — rooftop";
    }
  }

  // Lock/unlock hint visibility
  controls.addEventListener("lock", () => {
    hint.style.display = "none";
    updateHint();
    hint.style.display = "block";
  });
  controls.addEventListener("unlock", () => {
    hint.style.display = "block";
    hint.innerText = "Click to look around";
  });

  // Show initial hint
  updateHint();

  return { controls, update };
}