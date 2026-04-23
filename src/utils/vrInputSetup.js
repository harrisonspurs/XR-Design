const DEFAULT_DEADZONE = 0.2;
const TURN_SPEED = 2.4; // radians per second

export function setupVRInput(renderer, playerController) {
  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);
  let lastFrameTime = null;

  const state = {
    lastJumpPressed: false,
    lastInteractPressed: false,
    yawOffset: 0,
    baseReferenceSpace: null,
  };

  renderer.xr.addEventListener("sessionstart", () => {
    state.baseReferenceSpace = renderer.xr.getReferenceSpace() || null;
    state.yawOffset = 0;
  });

  renderer.xr.addEventListener("sessionend", () => {
    if (state.baseReferenceSpace) {
      renderer.xr.setReferenceSpace(state.baseReferenceSpace);
    }
    state.lastJumpPressed = false;
    state.lastInteractPressed = false;
    state.yawOffset = 0;
    state.baseReferenceSpace = null;
  });

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      const isVr = !!(frame && renderer.xr.isPresenting);
      const deltaSeconds =
        lastFrameTime === null ? 0 : Math.max(0, (time - lastFrameTime) / 1000);
      lastFrameTime = time;

      if (isVr && frame.session?.inputSources) {
        handleVRControllers(
          frame.session,
          playerController,
          renderer,
          deltaSeconds,
          state,
        );
      }

      callback(time, frame);
    });
  };
}

function handleVRControllers(
  session,
  playerController,
  renderer,
  deltaSeconds,
  state,
) {
  const movement = playerController.movement;

  let leftStick = { x: 0, y: 0 };
  let leftFound = false;
  let anyJumpPressed = false;
  let anyInteractPressed = false;
  let turnInput = 0;

  for (const source of session.inputSources) {
    if (!source?.gamepad) continue;
    if (source.handedness !== "left" && source.handedness !== "right") continue;

    const { x, y } = getThumbstickAxes(source.gamepad.axes);
    const buttons = source.gamepad.buttons || [];

    if (source.handedness === "left") {
      leftFound = true;
      leftStick = { x, y };
      if (isAnyButtonPressed(buttons, [3, 2])) {
        anyJumpPressed = true;
      }
      if (isAnyButtonPressed(buttons, [0, 1])) {
        anyInteractPressed = true;
      }
    }

    if (source.handedness === "right") {
      turnInput = x;
      if (isAnyButtonPressed(buttons, [3, 2])) {
        anyJumpPressed = true;
      }
      if (isAnyButtonPressed(buttons, [0, 1])) {
        anyInteractPressed = true;
      }
    }
  }

  if (!state.baseReferenceSpace) {
    state.baseReferenceSpace = renderer.xr.getReferenceSpace() || null;
  }

  if (!leftFound) {
    movement.forward = false;
    movement.backward = false;
    movement.left = false;
    movement.right = false;
  } else {
    const moveX = applyDeadzone(leftStick.x);
    const moveY = applyDeadzone(leftStick.y);

    movement.forward = moveY < -0.1;
    movement.backward = moveY > 0.1;
    movement.left = moveX < -0.1;
    movement.right = moveX > 0.1;
  }

  if (anyJumpPressed && !state.lastJumpPressed) {
    movement.jump = true;
  }
  if (!anyJumpPressed && state.lastJumpPressed) {
    movement.jump = false;
  }
  state.lastJumpPressed = anyJumpPressed;

  if (anyInteractPressed !== state.lastInteractPressed) {
    const eventName = anyInteractPressed ? "keydown" : "keyup";
    const event = new KeyboardEvent(eventName, {
      code: "KeyE",
      key: "e",
    });
    document.dispatchEvent(event);
    state.lastInteractPressed = anyInteractPressed;
  }

  if (
    Math.abs(turnInput) > DEFAULT_DEADZONE &&
    deltaSeconds > 0 &&
    state.baseReferenceSpace
  ) {
    state.yawOffset += -turnInput * TURN_SPEED * deltaSeconds;
    applyYawOffset(renderer, state.baseReferenceSpace, state.yawOffset);
  }
}

function getThumbstickAxes(axes = []) {
  if (axes.length >= 4) {
    const primary = { x: axes[0] ?? 0, y: axes[1] ?? 0 };
    const secondary = { x: axes[2] ?? 0, y: axes[3] ?? 0 };
    const primaryMag = Math.abs(primary.x) + Math.abs(primary.y);
    const secondaryMag = Math.abs(secondary.x) + Math.abs(secondary.y);
    return secondaryMag > primaryMag ? secondary : primary;
  }
  if (axes.length >= 2) {
    return { x: axes[0] ?? 0, y: axes[1] ?? 0 };
  }
  return { x: 0, y: 0 };
}

function applyDeadzone(value, deadzone = DEFAULT_DEADZONE) {
  return Math.abs(value) < deadzone ? 0 : value;
}

function isAnyButtonPressed(buttons, indices) {
  return indices.some((index) => buttons[index]?.pressed);
}

function applyYawOffset(renderer, baseReferenceSpace, yawRadians) {
  if (!renderer?.xr || !baseReferenceSpace || typeof XRRigidTransform === "undefined") {
    return;
  }
  const half = yawRadians / 2;
  const rotation = {
    x: 0,
    y: Math.sin(half),
    z: 0,
    w: Math.cos(half),
  };
  const transform = new XRRigidTransform({ x: 0, y: 0, z: 0 }, rotation);
  const offsetSpace = baseReferenceSpace.getOffsetReferenceSpace(transform);
  renderer.xr.setReferenceSpace(offsetSpace);
}
