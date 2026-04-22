import * as THREE from "three";

export function setupVRInput(renderer, playerController) {
  const MOVE_SPEED = 4;
  const TURN_SPEED = 2.5;

  let lastTime = 0;

  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      const delta =
        lastTime > 0 ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      if (frame && renderer.xr.isPresenting) {
        handleVRInput(renderer, playerController, delta);
      }

      callback(time, frame);
    });
  };
}

// ─────────────────────────────────────────────

function handleVRInput(renderer, playerController, delta) {
  const session = renderer.xr.getSession();
  if (!session) return;

  const body = playerController?.playerCollider?.body;
  if (!body) return;

  const movement = playerController.movement;

  let moveX = 0;
  let moveY = 0;
  let turnX = 0;

  for (const input of session.inputSources) {
    if (!input.gamepad) continue;

    const axes = input.gamepad.axes;
    const buttons = input.gamepad.buttons;

    // 🎮 LEFT CONTROLLER → movement
    if (input.handedness === "left") {
      moveX = axes[2] || 0;
      moveY = axes[3] || 0;

      // Deadzone
      if (Math.abs(moveX) < 0.2) moveX = 0;
      if (Math.abs(moveY) < 0.2) moveY = 0;

      // 🟢 Jump (A / X button)
      if (buttons[0]?.pressed) {
        movement.jump = true;
      }

      // 🟢 Trigger → simulate "E" interact
      if (buttons[0]?.pressed || buttons[1]?.pressed) {
        simulateEKey();
      }
    }

    // 🎮 RIGHT CONTROLLER → turning
    if (input.handedness === "right") {
      turnX = axes[2] || 0;

      if (Math.abs(turnX) < 0.2) turnX = 0;
    }
  }

  // ───────── MOVEMENT ─────────
  const xrCamera = renderer.xr.getCamera();

  const forward = new THREE.Vector3();
  xrCamera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), forward)
    .normalize();

  const vel = body.velocity;

  if (moveX !== 0 || moveY !== 0) {
    const vx = forward.x * moveY * 4 + right.x * moveX * 4;
    const vz = forward.z * moveY * 4 + right.z * moveX * 4;

    body.setVelocity(vx, vel.y, vz);
  } else {
    body.setVelocity(0, vel.y, 0);
  }

  // ───────── TURNING ─────────
  if (turnX !== 0) {
    const camera = renderer.xr.getCamera();
    camera.rotation.y -= turnX * delta * 2.5;
  }
}

// ─────────────────────────────────────────────

// Fake "E" key press for interaction system
function simulateEKey() {
  const event = new KeyboardEvent("keydown", {
    code: "KeyE",
  });
  document.dispatchEvent(event);
}