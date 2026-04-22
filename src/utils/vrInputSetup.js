import * as THREE from "three";

export function setupVRInput(renderer, playerController, playerSpawn) {
  let vrActive = false;
  let baseReferenceSpace = null;

  const MOVE_SPEED = 3;
  let lastTime = 0;

  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      const delta =
        lastTime > 0 ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      // ───────────── VR START ─────────────
      if (frame && renderer.xr.isPresenting && !vrActive) {
        vrActive = true;

        baseReferenceSpace = renderer.xr.getReferenceSpace();

        // ✅ SAFE: fallback to playerSpawn if something goes wrong
        const pos =
          playerController?.playerCollider?.position || playerSpawn;

        if (baseReferenceSpace && pos) {
          const spawnTransform = new XRRigidTransform(
            {
              x: pos.x,
              y: pos.y,
              z: pos.z,
            },
            { x: 0, y: 0, z: 0, w: 1 }
          );

          renderer.xr.setReferenceSpace(
            baseReferenceSpace.getOffsetReferenceSpace(spawnTransform)
          );
        }

        console.log("[VR] Sync position:", pos);
      }

      // ───────────── VR END ─────────────
      if (!renderer.xr.isPresenting && vrActive) {
        vrActive = false;
        baseReferenceSpace = null;
        lastTime = 0;
      }

      // ───────────── VR MOVEMENT ─────────────
      if (frame && renderer.xr.isPresenting && delta > 0) {
        handleVRMovement(renderer, playerController, delta, MOVE_SPEED);
      }

      callback(time, frame);
    });
  };
}

// ─────────────────────────────────────────────

function handleVRMovement(renderer, playerController, delta, MOVE_SPEED) {
  const session = renderer.xr.getSession();
  if (!session) return;

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

  const body = playerController?.playerCollider?.body;
  if (!body) return;

  if (Math.abs(stickX) < 0.01 && Math.abs(stickY) < 0.01) {
    const vel = body.velocity;
    body.setVelocity(0, vel.y, 0);
    return;
  }

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

  body.setVelocity(moveX, vel.y, moveZ);
}