import * as THREE from "three";

export function setupVRInput(renderer, playerController) {
  const MOVE_SPEED = 4;

  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {

      // Only run in VR
      if (frame && renderer.xr.isPresenting) {
        handleVRMovement(renderer, playerController, MOVE_SPEED);
      }

      callback(time, frame);
    });
  };
}

// ─────────────────────────────────────────────

function handleVRMovement(renderer, playerController, MOVE_SPEED) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const body = playerController?.playerCollider?.body;
  if (!body) return;

  let stickX = 0;
  let stickY = 0;
  const deadzone = 0.2;

  for (const input of session.inputSources) {
    if (input.handedness === "left" && input.gamepad) {
      const rawX = input.gamepad.axes[2] ?? 0;
      const rawY = input.gamepad.axes[3] ?? 0;

      stickX = Math.abs(rawX) > deadzone ? rawX : 0;
      stickY = Math.abs(rawY) > deadzone ? rawY : 0;
    }
  }

  // No input → stop horizontal movement
  if (Math.abs(stickX) < 0.01 && Math.abs(stickY) < 0.01) {
    const vel = body.velocity;
    body.setVelocity(0, vel.y, 0);
    return;
  }

  // Get headset direction
  const xrCamera = renderer.xr.getCamera();

  const forward = new THREE.Vector3();
  xrCamera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize();

  const moveX =
    forward.x * stickY * MOVE_SPEED +
    right.x * stickX * MOVE_SPEED;

  const moveZ =
    forward.z * stickY * MOVE_SPEED +
    right.z * stickX * MOVE_SPEED;

  const vel = body.velocity;

  body.setVelocity(
    moveX,
    vel.y, // keep gravity
    moveZ
  );
}