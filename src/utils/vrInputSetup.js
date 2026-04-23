const DEFAULT_DEADZONE = 0.2;
const TURN_SPEED = 2.4; // radians per second

export function setupVRInput(renderer, playerController) {
  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);
  let lastFrameTime = null;

  const state = {
    playerMovement: playerController.movement,
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
        if (!state.baseReferenceSpace) {
          state.baseReferenceSpace = renderer.xr.getReferenceSpace() || null;
        }
        handleVRControllers(frame.session, deltaSeconds, state);
      }

      callback(time, frame);

      if (isVr && frame && state.baseReferenceSpace) {
        syncReferenceSpace(
          renderer,
          frame,
          state.baseReferenceSpace,
          playerController,
          state.yawOffset,
        );
      }
    });
  };
}

function handleVRControllers(session, deltaSeconds, state) {
  const movement = state.playerMovement;

  let leftStick = { x: 0, y: 0 };
  let leftFound = false;
  let anyJumpPressed = false;
  let anyInteractPressed = false;
  let turnInput = 0;

  const sources = Array.from(session.inputSources).filter(
    (source) => source?.gamepad,
  );
  const leftSource = sources.find((source) => source.handedness === "left");
  const rightSource = sources.find((source) => source.handedness === "right");
  const unknownSources = sources.filter(
    (source) =>
      source.handedness !== "left" && source.handedness !== "right",
  );

  const movementSource = leftSource ?? unknownSources[0] ?? rightSource ?? null;
  const turnSource =
    rightSource ??
    (unknownSources.length > 1 ?
      unknownSources[1]
    : unknownSources[0] !== movementSource ?
      unknownSources[0]
    : null);

  const sourcesToCheck = [];
  if (movementSource) sourcesToCheck.push(movementSource);
  if (turnSource && turnSource !== movementSource) sourcesToCheck.push(turnSource);

  for (const source of sourcesToCheck) {
    if (!source?.gamepad) continue;

    const { x, y } = getThumbstickAxes(source.gamepad.axes);
    const buttons = source.gamepad.buttons || [];

    if (source === movementSource) {
      leftFound = true;
      leftStick = { x, y };
      if (isAnyButtonPressed(buttons, [3, 2])) {
        anyJumpPressed = true;
      }
      if (isAnyButtonPressed(buttons, [0, 1])) {
        anyInteractPressed = true;
      }
    }

    if (source === turnSource) {
      turnInput = x;
      if (isAnyButtonPressed(buttons, [3, 2])) {
        anyJumpPressed = true;
      }
      if (isAnyButtonPressed(buttons, [0, 1])) {
        anyInteractPressed = true;
      }
    }
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
    state.yawOffset += turnInput * TURN_SPEED * deltaSeconds;
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

function syncReferenceSpace(
  renderer,
  frame,
  baseReferenceSpace,
  playerController,
  yawRadians,
) {
  if (!renderer?.xr || typeof XRRigidTransform === "undefined") {
    return;
  }
  const collider = playerController?.playerCollider;
  if (!collider?.position) return;

  const pose = frame.getViewerPose(baseReferenceSpace);
  if (!pose?.transform?.position) return;

  const playerHeight =
    Number.isFinite(playerController?.PLAYER_HEIGHT) ?
      playerController.PLAYER_HEIGHT
    : 1.6;
  const cameraOffset =
    Number.isFinite(playerController?.cameraYOffset) ?
      playerController.cameraYOffset
    : 0;

  const desiredHead = {
    x: collider.position.x,
    y: collider.position.y + cameraOffset,
    z: collider.position.z,
  };

  const head = pose.transform.position;
  const position = {
    x: desiredHead.x - head.x,
    y: desiredHead.y - head.y,
    z: desiredHead.z - head.z,
  };

  const half = yawRadians / 2;
  const rotation = {
    x: 0,
    y: Math.sin(half),
    z: 0,
    w: Math.cos(half),
  };

  const transform = new XRRigidTransform(position, rotation);
  const offsetSpace = baseReferenceSpace.getOffsetReferenceSpace(transform);
  renderer.xr.setReferenceSpace(offsetSpace);
}
