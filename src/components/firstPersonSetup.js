import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

/**
 * Baseline configuration for player movement and capsule characteristics.
 */
const DEFAULT_CONFIG = {
  playerHeight: 1.6,
  gravity: 28,
  walkAcceleration: 5,
  sprintAcceleration: 10,
  movementDamping: 12,
  jumpSpeed: 12,
  capsuleRadius: 0.4,
  capsuleMass: 80,
};

/**
 * Renders a lightweight DOM hint prompting the user to engage pointer lock.
 */
function buildPointerHint() {
  const element = document.createElement("div");
  element.id = "pointer-lock-hint";
  element.textContent =
    "Click for first-person (WASD + mouse, Space to jump, Esc to release)";
  element.style.position = "absolute";
  element.style.top = "16px";
  element.style.left = "50%";
  element.style.transform = "translateX(-50%)";
  element.style.padding = "8px 12px";
  element.style.fontFamily = "sans-serif";
  element.style.fontSize = "14px";
  element.style.color = "#ffffff";
  element.style.background = "rgba(0, 0, 0, 0.6)";
  element.style.borderRadius = "6px";
  element.style.pointerEvents = "none";
  element.style.display = "";
  document.body.appendChild(element);

  return {
    element,
    teardown: () => {
      if (element.parentNode) element.parentNode.removeChild(element);
    },
  };
}

/**
 * Constructs the mutable movement state used by both physics and kinematic updates.
 */
function initializeMovementState() {
  return {
    moveState: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
    },
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    isGrounded: true,
    pendingJump: false,
    jumpBoost: false,
  };
}

/**
 * Maps keyboard events onto the movement state while capturing jump intents.
 */
function createInputHandler(movement) {
  return (event, isPressed) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        movement.moveState.forward = isPressed;
        break;
      case "KeyS":
      case "ArrowDown":
        movement.moveState.backward = isPressed;
        break;
      case "KeyA":
      case "ArrowLeft":
        movement.moveState.left = isPressed;
        break;
      case "KeyD":
      case "ArrowRight":
        movement.moveState.right = isPressed;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        movement.moveState.sprint = isPressed;
        break;
      case "Space":
        movement.moveState.jump = isPressed;
        if (isPressed && movement.isGrounded) {
          movement.pendingJump = true;
          movement.jumpBoost = movement.moveState.forward;
        }
        if (!isPressed) {
          movement.pendingJump = false;
          movement.jumpBoost = false;
        }
        break;
      default:
        break;
    }
  };
}

/**
 * Resets jump-related transient state to avoid stale impulses.
 */
function resetJumpState(movement) {
  movement.pendingJump = false;
  movement.jumpBoost = false;
}

/**
 * Ensures pointer targets receive focus without scrolling the viewport.
 */
function focusPointerTarget(element) {
  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
}

/**
 * Configures pointer-lock controls and returns an update loop to drive movement each frame.
 */
export async function firstPersonSetup(camera, renderer, options = {}) {
  const {
    terrainBounds: terrainBoundsOverride = null,
    terrainData = null,
    dynamicCapsule = null,
    capsuleOffset = { x: 0, y: 0, z: 0 },
    ...configOverrides
  } = options;

  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const pointerElement = renderer?.domElement || document.body;
  if (pointerElement instanceof HTMLElement) {
    if (!pointerElement.hasAttribute("tabindex")) {
      pointerElement.setAttribute("tabindex", "-1");
    }
    pointerElement.style.outline = "none";
  }

  const controls = new PointerLockControls(camera, pointerElement);
  const controlsObject =
    (typeof controls.getObject === "function" && controls.getObject()) ||
    controls.object ||
    controls.camera ||
    camera;

  const setCameraPosition = (x, y, z) => {
    controlsObject.position.set(x, y, z);
    camera.position.set(x, y, z);
    if (dynamicCapsule && dynamicCapsule.position) {
      dynamicCapsule.position.set(
        x + capsuleOffset.x,
        y + capsuleOffset.y,
        z + capsuleOffset.z,
      );
    }
  };

  const { element: pointerHint } = buildPointerHint();

  const movement = initializeMovementState();
  const handleKey = createInputHandler(movement);

  controls.addEventListener("lock", () => {
    pointerHint.style.display = "none";
    focusPointerTarget(pointerElement);
  });

  controls.addEventListener("unlock", () => {
    if (!window.__disablePointerLock) {
      pointerHint.style.display = "";
    }
    Object.keys(movement.moveState).forEach((key) => {
      movement.moveState[key] = false;
    });
    movement.velocity.set(0, 0, 0);
    resetJumpState(movement);
    movement.isGrounded = true;
  });

  pointerElement.addEventListener("click", () => {
    if (window.__disablePointerLock) return;
    focusPointerTarget(pointerElement);
    if (!controls.isLocked) controls.lock();
  });

  const keydownListener = (event) => handleKey(event, true);
  const keyupListener = (event) => handleKey(event, false);
  const keyTargets = new Set([
    window,
    pointerElement?.ownerDocument || document,
  ]);
  if (pointerElement && typeof pointerElement.addEventListener === "function") {
    keyTargets.add(pointerElement);
  }
  keyTargets.forEach((target) => {
    target.addEventListener("keydown", keydownListener);
    target.addEventListener("keyup", keyupListener);
  });

  /**
   * Kinematic fallback when physics is disabled.
   */
  function updateKinematicMovement(delta) {
    movement.velocity.x -= movement.velocity.x * config.movementDamping * delta;
    movement.velocity.z -= movement.velocity.z * config.movementDamping * delta;

    movement.direction.z =
      Number(movement.moveState.forward) - Number(movement.moveState.backward);
    movement.direction.x =
      Number(movement.moveState.right) - Number(movement.moveState.left);
    if (movement.direction.lengthSq() > 0) movement.direction.normalize();

    const acceleration =
      movement.moveState.sprint ?
        config.sprintAcceleration
      : config.walkAcceleration;

    if (movement.moveState.forward || movement.moveState.backward) {
      movement.velocity.z -= movement.direction.z * acceleration * delta;
    }
    if (movement.moveState.left || movement.moveState.right) {
      movement.velocity.x -= movement.direction.x * acceleration * delta;
    }

    if (movement.pendingJump && movement.isGrounded) {
      movement.velocity.y = config.jumpSpeed;
      movement.isGrounded = false;
      if (movement.jumpBoost) {
        movement.velocity.z -= config.walkAcceleration * 0.1;
      }
    }
    resetJumpState(movement);

    movement.velocity.y -= config.gravity * delta;

    controls.moveRight(-movement.velocity.x * delta);
    controls.moveForward(-movement.velocity.z * delta);

    const controlsPosition = controlsObject.position;
    const nextY = controlsPosition.y + movement.velocity.y * delta;
    setCameraPosition(controlsPosition.x, nextY, controlsPosition.z);
  }

  const player = {
    controls,
    moveState: movement.moveState,
    velocity: movement.velocity,
    direction: movement.direction,
    update(delta) {
      const isActive = controls.isLocked;
      if (isActive) {
        updateKinematicMovement(delta);
      } else {
        movement.velocity.set(0, 0, 0);
        movement.direction.set(0, 0, 0);
        resetJumpState(movement);
      }
    },
    get isGrounded() {
      return movement.isGrounded;
    },
    set isGrounded(value) {
      movement.isGrounded = value;
    },
    config,
    collider: null,
    get usingPhysics() {
      return false;
    },
  };

  return player;
}
