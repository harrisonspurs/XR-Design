import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

const crosshairRaycaster = new THREE.Raycaster();
const crosshairCenter = new THREE.Vector2(0, 0);
const raycastMeshesCache = new WeakMap();

function getRaycastMeshes(object) {
  let meshes = raycastMeshesCache.get(object);
  if (meshes) return meshes;

  meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.visible) meshes.push(child);
  });
  raycastMeshesCache.set(object, meshes);
  return meshes;
}

export function isLookingAt(camera, object, maxDistance = 4) {
  if (!object) return false;
  const maxDistanceSq = maxDistance * maxDistance;
  if (camera.position.distanceToSquared(object.position) > maxDistanceSq * 2.25) {
    return false;
  }

  const meshes = getRaycastMeshes(object);
  if (meshes.length === 0) return false;

  crosshairRaycaster.setFromCamera(crosshairCenter, camera);
  crosshairRaycaster.far = maxDistance;
  return crosshairRaycaster.intersectObjects(meshes, false).length > 0;
}

export function createControls(camera, renderer, getIsSeated = () => false) {

  const controls = new PointerLockControls(camera, renderer.domElement);
  renderer.domElement.addEventListener("click", () => controls.lock());

  const keys = {
    w: false, a: false, s: false, d: false,
    shift: false, space: false, ctrl: false,
  };

  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "KeyW":        keys.w     = true;  break;
      case "KeyA":        keys.a     = true;  break;
      case "KeyS":        keys.s     = true;  break;
      case "KeyD":        keys.d     = true;  break;
      case "ShiftLeft":   keys.shift = true;  break;
      case "Space":       keys.space = true;  break;
      case "ControlLeft": keys.ctrl  = true;  break;
      case "KeyT":        teleport();         break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "KeyW":        keys.w     = false; break;
      case "KeyA":        keys.a     = false; break;
      case "KeyS":        keys.s     = false; break;
      case "KeyD":        keys.d     = false; break;
      case "ShiftLeft":   keys.shift = false; break;
      case "Space":       keys.space = false; break;
      case "ControlLeft": keys.ctrl  = false; break;
    }
  });

  const levels = {
    rooftop: { x: 9, y: 10.5, z: 1 },
    ground:  { x: 9, y: 1.7,  z: 8 },
  };
  let currentLevel = "rooftop";

  function teleport() {
    if (currentLevel === "rooftop") {
      camera.position.set(levels.ground.x, levels.ground.y, levels.ground.z);
      currentLevel = "ground";
    } else {
      camera.position.set(levels.rooftop.x, levels.rooftop.y, levels.rooftop.z);
      currentLevel = "rooftop";
    }
    updateHint();
  }

  let velocityY = 0;
  let isJumping = false;
  const GRAVITY        = 0.016;
  const ROOFTOP_HEIGHT = 10.5;
  const GROUND_HEIGHT  = 1.7;
  const CROUCH_OFFSET  = 0.5;

  function isInsideRooftopBounds() {
    return (
      camera.position.x > 5 && camera.position.x < 13 &&
      camera.position.z > -4 && camera.position.z < 6
    );
  }

  function applyGravity() {
    velocityY -= GRAVITY;
    camera.position.y += velocityY;

    if (camera.position.y <= ROOFTOP_HEIGHT + 0.1 && isInsideRooftopBounds()) {
      if (!keys.ctrl) camera.position.y = ROOFTOP_HEIGHT;
      velocityY = 0;
      isJumping = false;
      currentLevel = "rooftop";
      updateHint();
    }

    if (camera.position.y <= GROUND_HEIGHT) {
      camera.position.y = GROUND_HEIGHT;
      velocityY = 0;
      isJumping = false;
      currentLevel = "ground";
      updateHint();
    }
  }

  const walkSpeed    = 0.08;
  const sprintSpeed  = 0.18;
  const ACCELERATION = 0.12;
  const DAMPING      = 0.85;

  let velForward = 0;
  let velRight   = 0;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function update() {
    if (!controls.isLocked) return;
    if (getIsSeated()) return;

    const targetSpeed = keys.shift ? sprintSpeed : walkSpeed;

    let targetForward = 0;
    let targetRight   = 0;

    if (keys.w) targetForward += targetSpeed;
    if (keys.s) targetForward -= targetSpeed;
    if (keys.a) targetRight   -= targetSpeed;
    if (keys.d) targetRight   += targetSpeed;

    velForward = lerp(velForward, targetForward, ACCELERATION);
    velRight   = lerp(velRight,   targetRight,   ACCELERATION);

    if (!keys.w && !keys.s) velForward *= DAMPING;
    if (!keys.a && !keys.d) velRight   *= DAMPING;

    if (Math.abs(velForward) > 0.001) controls.moveForward(velForward);
    if (Math.abs(velRight)   > 0.001) controls.moveRight(velRight);

    // Walking off the roof should immediately put player in falling state.
    if (currentLevel === "rooftop" && !isInsideRooftopBounds()) {
      currentLevel = "ground";
      isJumping = true;
      if (velocityY > 0) velocityY = 0;
    }

    if (keys.space && !isJumping) {
      velocityY = 0.15;
      isJumping = true;
    }

    if (!isJumping) {
      const baseHeight   = currentLevel === "rooftop" ? ROOFTOP_HEIGHT : GROUND_HEIGHT;
      const targetHeight = keys.ctrl ? baseHeight - CROUCH_OFFSET : baseHeight;
      camera.position.y = lerp(camera.position.y, targetHeight, 0.15);
    }

    applyGravity();
  }

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

  const crosshair = document.createElement("div");
  crosshair.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.7);
    pointer-events: none;
    display: none;
  `;
  document.body.appendChild(crosshair);

  function updateHint() {
    hint.innerText = currentLevel === "rooftop"
      ? "WASD — move   |   Shift — sprint   |   Ctrl — crouch   |   Space — jump   |   T — ground"
      : "WASD — move   |   Shift — sprint   |   Ctrl — crouch   |   Space — jump   |   T — rooftop";
  }

  controls.addEventListener("lock", () => {
    updateHint();
    hint.style.display = "block";
    crosshair.style.display = "block";
  });
  controls.addEventListener("unlock", () => {
    hint.innerText = "Click to look around";
    crosshair.style.display = "none";
  });

  updateHint();

  return { controls, update };
}