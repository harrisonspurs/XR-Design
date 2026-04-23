import * as THREE from "three";

const DEADZONE = 0.2;
const TURN_SPEED = 2.6; // radians/sec
const VR_FORWARD = new THREE.Vector3(0, 0, -1);
const vrLookDirection = new THREE.Vector3();
const vrLookRotation = new THREE.Quaternion();

export function setupVRInput(renderer, playerController) {
  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);
  let lastFrameTime = null;

  const state = {
    movement: playerController.movement,
    lastJumpPressed: false,
    lastInteractPressed: false,
    lastUiPrevPressed: false,
    lastUiNextPressed: false,
    lastUiSelectPressed: false,
    lastUiClosePressed: false,
    yawOffset: 0,
    baseReferenceSpace: null,
    anchorHead: null,
    lastReferenceTransform: null,
    lastUiNavAt: 0,
  };

  renderer.xr.addEventListener("sessionstart", () => {
    window.__vrIsPresenting = true;
    window.__vrLookRay = null;
    window.__recordBoxUiOpen = false;
    window.__recordBoxUiLabel = "";
    window.__activeInteractionId = null;
    state.baseReferenceSpace = renderer.xr.getReferenceSpace() || null;
    state.lastJumpPressed = false;
    state.lastInteractPressed = false;
    state.lastUiPrevPressed = false;
    state.lastUiNextPressed = false;
    state.lastUiSelectPressed = false;
    state.lastUiClosePressed = false;
    state.yawOffset = 0;
    state.anchorHead = null;
    state.lastReferenceTransform = null;
    state.lastUiNavAt = 0;
  });

  renderer.xr.addEventListener("sessionend", () => {
    window.__vrIsPresenting = false;
    window.__vrLookRay = null;
    window.__recordBoxUiOpen = false;
    window.__recordBoxUiLabel = "";
    window.__activeInteractionId = null;
    if (state.baseReferenceSpace) {
      renderer.xr.setReferenceSpace(state.baseReferenceSpace);
    }
    if (state.lastInteractPressed) {
      dispatchInteractionKeys("keyup");
    }
    state.movement.forward = false;
    state.movement.backward = false;
    state.movement.left = false;
    state.movement.right = false;
    state.movement.jump = false;
    state.lastJumpPressed = false;
    state.lastInteractPressed = false;
    state.lastUiPrevPressed = false;
    state.lastUiNextPressed = false;
    state.lastUiSelectPressed = false;
    state.lastUiClosePressed = false;
    state.yawOffset = 0;
    state.baseReferenceSpace = null;
    state.anchorHead = null;
    state.lastReferenceTransform = null;
    state.lastUiNavAt = 0;
  });

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      const isVr = !!(frame && renderer.xr.isPresenting);
      const deltaSeconds =
        lastFrameTime === null ? 0 : Math.max(0, (time - lastFrameTime) / 1000);
      lastFrameTime = time;

      if (isVr) {
        if (!state.baseReferenceSpace) {
          state.baseReferenceSpace = renderer.xr.getReferenceSpace() || null;
        }
        updateVRLookRay(
          frame,
          renderer.xr.getReferenceSpace() || state.baseReferenceSpace,
        );
        if (frame.session?.inputSources) {
          readControllerInput(frame.session, deltaSeconds, state);
        }
        if (state.baseReferenceSpace) {
          syncToPlayerReferenceSpace(
            renderer,
            frame,
            state.baseReferenceSpace,
            playerController,
            state.yawOffset,
            state,
          );
        }
      }

      callback(time, frame);
    });
  };
}

function readControllerInput(session, deltaSeconds, state) {
  const movement = state.movement;
  const sources = Array.from(session.inputSources).filter((src) => src?.gamepad);

  if (sources.length === 0) {
    movement.forward = false;
    movement.backward = false;
    movement.left = false;
    movement.right = false;
    movement.jump = false;
    if (state.lastInteractPressed) {
      dispatchInteractionKeys("keyup");
      state.lastInteractPressed = false;
    }
    state.lastJumpPressed = false;
    return;
  }

  const left = sources.find((src) => src.handedness === "left") || null;
  const right = sources.find((src) => src.handedness === "right") || null;
  const unknown = sources.filter(
    (src) => src.handedness !== "left" && src.handedness !== "right",
  );

  const moveSource = left ?? unknown[0] ?? right ?? null;
  const turnSource = right ?? unknown[1] ?? (moveSource === right ? null : moveSource);
  const moveButtons = moveSource?.gamepad?.buttons || null;
  const turnButtons = turnSource?.gamepad?.buttons || null;
  const moveAxes = moveSource ? getPreferredStick(moveSource.gamepad.axes) : { x: 0, y: 0 };
  const turnAxes = turnSource ? getPreferredStick(turnSource.gamepad.axes) : { x: 0, y: 0 };

  if (window.__recordBoxUiOpen) {
    movement.forward = false;
    movement.backward = false;
    movement.left = false;
    movement.right = false;
    movement.jump = false;
    if (state.lastInteractPressed) {
      dispatchInteractionKeys("keyup");
      state.lastInteractPressed = false;
    }
    state.lastJumpPressed = false;
    handleRecordBoxUIInput(moveButtons, turnButtons, moveAxes, turnAxes, state);
    return;
  } else {
    state.lastUiPrevPressed = false;
    state.lastUiNextPressed = false;
    state.lastUiSelectPressed = false;
    state.lastUiClosePressed = false;
  }

  const moveX = applyDeadzone(moveAxes.x);
  const moveY = applyDeadzone(moveAxes.y);
  const turnX = applyDeadzone(turnAxes.x);

  movement.forward = moveY < -0.1;
  movement.backward = moveY > 0.1;
  movement.left = moveX < -0.1;
  movement.right = moveX > 0.1;

  const jumpPressed =
    isAnyButtonPressed(moveButtons, [3, 4, 5, 2]) ||
    isAnyButtonPressed(turnButtons, [3, 4, 5, 2]);

  if (jumpPressed && !state.lastJumpPressed) {
    movement.jump = true;
  }
  if (!jumpPressed && state.lastJumpPressed) {
    movement.jump = false;
  }
  state.lastJumpPressed = jumpPressed;

  const interactPressed =
    isAnyButtonPressed(moveButtons, [0, 1]) ||
    isAnyButtonPressed(turnButtons, [0, 1]);

  if (interactPressed !== state.lastInteractPressed) {
    const eventName = interactPressed ? "keydown" : "keyup";
    dispatchInteractionKeys(eventName);
    state.lastInteractPressed = interactPressed;
  }

  if (Math.abs(turnX) > DEADZONE && deltaSeconds > 0) {
    state.yawOffset += turnX * TURN_SPEED * deltaSeconds;
    state.yawOffset = normalizeAngle(state.yawOffset);
  }
}

function syncToPlayerReferenceSpace(
  renderer,
  frame,
  baseReferenceSpace,
  playerController,
  yawRadians,
  state,
) {
  if (!renderer?.xr || typeof XRRigidTransform === "undefined") return;
  const collider = playerController?.playerCollider;
  if (!collider?.position) return;

  if (!state.anchorHead) {
    const pose = frame.getViewerPose(baseReferenceSpace);
    const head = pose?.transform?.position;
    if (!head) return;
    state.anchorHead = { x: head.x, y: head.y, z: head.z };
  }

  const cameraOffset =
    Number.isFinite(playerController?.cameraYOffset) ?
      playerController.cameraYOffset
    : 0;

  const desiredHeadX = collider.position.x;
  const desiredHeadY = collider.position.y + cameraOffset;
  const desiredHeadZ = collider.position.z;

  // Keep the session-start head position as anchor so physical head motion
  // remains 1:1 while locomotion/turn updates move the world origin.
  const cos = Math.cos(yawRadians);
  const sin = Math.sin(yawRadians);
  const rotatedDesiredX = cos * desiredHeadX + sin * desiredHeadZ;
  const rotatedDesiredZ = -sin * desiredHeadX + cos * desiredHeadZ;

  const translation = {
    x: state.anchorHead.x - rotatedDesiredX,
    y: state.anchorHead.y - desiredHeadY,
    z: state.anchorHead.z - rotatedDesiredZ,
  };

  if (!shouldApplyReferenceUpdate(state.lastReferenceTransform, translation, yawRadians)) {
    return;
  }

  const half = yawRadians / 2;
  const rotation = {
    x: 0,
    y: Math.sin(half),
    z: 0,
    w: Math.cos(half),
  };

  const transform = new XRRigidTransform(translation, rotation);
  renderer.xr.setReferenceSpace(
    baseReferenceSpace.getOffsetReferenceSpace(transform),
  );
  state.lastReferenceTransform = {
    x: translation.x,
    y: translation.y,
    z: translation.z,
    yaw: yawRadians,
  };
}

function getPreferredStick(axes = []) {
  if (axes.length >= 4) {
    const stickA = { x: axes[0] ?? 0, y: axes[1] ?? 0 };
    const stickB = { x: axes[2] ?? 0, y: axes[3] ?? 0 };
    const magA = Math.abs(stickA.x) + Math.abs(stickA.y);
    const magB = Math.abs(stickB.x) + Math.abs(stickB.y);
    if (magB > magA) return stickB;
    return stickA;
  }
  if (axes.length >= 2) {
    return { x: axes[0] ?? 0, y: axes[1] ?? 0 };
  }
  return { x: 0, y: 0 };
}

function applyDeadzone(value) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

function isAnyButtonPressed(buttons, indices) {
  if (!buttons) return false;
  return indices.some((index) => !!buttons[index]?.pressed);
}

function normalizeAngle(value) {
  const twoPi = Math.PI * 2;
  let angle = ((value % twoPi) + twoPi) % twoPi;
  if (angle > Math.PI) angle -= twoPi;
  return angle;
}

function shouldApplyReferenceUpdate(lastTransform, translation, yaw) {
  if (!lastTransform) return true;
  const positionEpsilon = 0.0005;
  const yawEpsilon = 0.0005;
  return (
    Math.abs(lastTransform.x - translation.x) > positionEpsilon ||
    Math.abs(lastTransform.y - translation.y) > positionEpsilon ||
    Math.abs(lastTransform.z - translation.z) > positionEpsilon ||
    Math.abs(lastTransform.yaw - yaw) > yawEpsilon
  );
}

function updateVRLookRay(frame, referenceSpace) {
  if (!frame || !referenceSpace) return;
  const pose = frame.getViewerPose(referenceSpace);
  const transform = pose?.transform;
  if (!transform?.position || !transform?.orientation) return;

  const position = transform.position;
  const orientation = transform.orientation;
  vrLookRotation.set(
    orientation.x,
    orientation.y,
    orientation.z,
    orientation.w,
  );
  vrLookDirection.copy(VR_FORWARD).applyQuaternion(vrLookRotation).normalize();

  window.__vrLookRay = {
    origin: { x: position.x, y: position.y, z: position.z },
    direction: {
      x: vrLookDirection.x,
      y: vrLookDirection.y,
      z: vrLookDirection.z,
    },
  };
}

function handleRecordBoxUIInput(moveButtons, turnButtons, moveAxes, turnAxes, state) {
  const now = performance.now();
  const navThreshold = 0.65;
  const navCooldownMs = 220;
  const navAxis =
    Math.abs(turnAxes.x) > Math.abs(moveAxes.x) ? turnAxes.x : moveAxes.x;

  if (Math.abs(navAxis) > navThreshold && now - state.lastUiNavAt > navCooldownMs) {
    dispatchKeyTap(navAxis > 0 ? "ArrowRight" : "ArrowLeft", navAxis > 0 ? "ArrowRight" : "ArrowLeft");
    state.lastUiNavAt = now;
  }

  const prevPressed =
    isAnyButtonPressed(moveButtons, [5]) || isAnyButtonPressed(turnButtons, [5]);
  const nextPressed =
    isAnyButtonPressed(moveButtons, [4]) || isAnyButtonPressed(turnButtons, [4]);
  const selectPressed =
    isAnyButtonPressed(moveButtons, [0]) || isAnyButtonPressed(turnButtons, [0]);
  const closePressed =
    isAnyButtonPressed(moveButtons, [1]) || isAnyButtonPressed(turnButtons, [1]);

  if (prevPressed && !state.lastUiPrevPressed) {
    dispatchKeyTap("ArrowLeft", "ArrowLeft");
  }
  if (nextPressed && !state.lastUiNextPressed) {
    dispatchKeyTap("ArrowRight", "ArrowRight");
  }
  if (selectPressed && !state.lastUiSelectPressed) {
    dispatchKeyTap("Enter", "Enter");
  }
  if (closePressed && !state.lastUiClosePressed) {
    dispatchKeyTap("Escape", "Escape");
  }

  state.lastUiPrevPressed = prevPressed;
  state.lastUiNextPressed = nextPressed;
  state.lastUiSelectPressed = selectPressed;
  state.lastUiClosePressed = closePressed;
}

function dispatchKeyTap(code, key) {
  document.dispatchEvent(new KeyboardEvent("keydown", { code, key }));
  document.dispatchEvent(new KeyboardEvent("keyup", { code, key }));
}

function dispatchInteractionKeys(eventName) {
  document.dispatchEvent(
    new KeyboardEvent(eventName, {
      code: "KeyE",
      key: "e",
    }),
  );
  const shouldDispatchPortalUse =
    eventName === "keydown" &&
    window.__vrIsPresenting &&
    !window.__recordBoxUiOpen &&
    !window.__activeInteractionId;
  if (!shouldDispatchPortalUse) return;
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      code: "KeyR",
      key: "r",
    }),
  );
}
