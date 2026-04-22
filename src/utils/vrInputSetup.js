import * as THREE from "three";

export function setupVRInput(renderer, playerController, playerSpawn) {
  let vrActive = false;

  // Store the original reference space so we always offset from it cleanly
  let baseReferenceSpace = null;

  // Track our cumulative world offset from the base reference space
  // Start at spawn so the first teleport is relative to origin
  const cumulativeOffset = new THREE.Vector3(
    playerSpawn.x,
    playerSpawn.y - 1.6, // subtract approx head height so feet land at spawn Y
    playerSpawn.z
  );

  const MOVE_SPEED = 3; // units per second, tune to feel right
  let lastTime = 0;

  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      const delta = lastTime > 0 ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;

      // ── VR just started ────────────────────────────────────────────────
      if (frame && renderer.xr.isPresenting && !vrActive) {
        vrActive = true;

        // Save the raw reference space so we can always offset from it
        baseReferenceSpace = renderer.xr.getReferenceSpace();

        // Teleport to rooftop by offsetting the XR reference space
        // This moves the whole VR world so the player appears at spawn
        if (baseReferenceSpace) {
          const spawnTransform = new XRRigidTransform(
            {
              x: playerSpawn.x,
              y: playerSpawn.y - 1.6,
              z: playerSpawn.z,
            },
            { x: 0, y: 0, z: 0, w: 1 }
          );
          renderer.xr.setReferenceSpace(
            baseReferenceSpace.getOffsetReferenceSpace(spawnTransform)
          );
        }

        // Also move the physics capsule to the rooftop spawn
        // This keeps collision detection in sync with the camera
        playerController.standUp(playerSpawn);

        console.log("[VR] Spawned at rooftop:", playerSpawn);
      }

      // ── VR just ended ──────────────────────────────────────────────────
      if (!renderer.xr.isPresenting && vrActive) {
        vrActive = false;
        baseReferenceSpace = null;
        lastTime = 0;

        // Reset cumulative offset back to spawn for next VR session
        cumulativeOffset.set(
          playerSpawn.x,
          playerSpawn.y - 1.6,
          playerSpawn.z
        );
      }

      // ── VR movement each frame ─────────────────────────────────────────
      if (frame && renderer.xr.isPresenting && delta > 0) {
        handleVRMovement(
          renderer,
          playerController,
          baseReferenceSpace,
          cumulativeOffset,
          delta,
          MOVE_SPEED
        );
      }

      callback(time, frame);
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function handleVRMovement(
  renderer,
  playerController,
  baseReferenceSpace,
  cumulativeOffset,
  delta,
  MOVE_SPEED
) {
  if (!baseReferenceSpace) return;

  // Read left controller thumbstick
  const session = renderer.xr.getSession();
  if (!session) return;

  let stickX = 0;
  let stickY = 0;
  const deadzone = 0.2;

  for (const input of session.inputSources) {
    // Use handedness instead of index - more reliable on Quest
    if (input.handedness === "left" && input.gamepad) {
      const rawX = input.gamepad.axes[2] ?? 0;
      const rawY = input.gamepad.axes[3] ?? 0;
      stickX = Math.abs(rawX) > deadzone ? rawX : 0;
      stickY = Math.abs(rawY) > deadzone ? rawY : 0;
    }
  }

  // Nothing pressed - stop horizontal physics movement and return
  if (Math.abs(stickX) < 0.01 && Math.abs(stickY) < 0.01) {
    const body = playerController.playerCollider?.body;
    if (body) {
      const vel = body.velocity;
      body.setVelocity(0, vel.y, 0);
    }
    return;
  }

  // Get the XR camera's world direction so movement follows where you look
  const xrCamera = renderer.xr.getCamera();
  const forward = new THREE.Vector3();
  xrCamera.getWorldDirection(forward);
  forward.y = 0; // flatten to horizontal plane only
  forward.normalize();

  // Right is perpendicular to forward
  const right = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();

  // Build this frame's movement delta
  const moveX =
    forward.x * stickY * MOVE_SPEED * delta +
    right.x * stickX * MOVE_SPEED * delta;
  const moveZ =
    forward.z * stickY * MOVE_SPEED * delta +
    right.z * stickX * MOVE_SPEED * delta;

  // Accumulate offset so we always set from the base reference space cleanly
  // This avoids floating point drift from chaining getOffsetReferenceSpace calls
  cumulativeOffset.x += moveX;
  cumulativeOffset.z += moveZ;

  // Apply the total cumulative offset from the base reference space
  const offsetTransform = new XRRigidTransform(
    { x: cumulativeOffset.x, y: cumulativeOffset.y, z: cumulativeOffset.z },
    { x: 0, y: 0, z: 0, w: 1 }
  );
  renderer.xr.setReferenceSpace(
    baseReferenceSpace.getOffsetReferenceSpace(offsetTransform)
  );

  // Move physics capsule in sync so collision still works
  const body = playerController.playerCollider?.body;
  if (body) {
    const vel = body.velocity;
    // Set velocity (not position) so Ammo handles gravity and collision
    body.setVelocity(
      moveX / delta,
      vel.y, // preserve Y so gravity and jumping still work
      moveZ / delta
    );
  }
}