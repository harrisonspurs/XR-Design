import * as THREE from "three";
import { firstPersonSetup } from "./firstPersonSetup.js";

// Set up keyboard input handlers for WASD movement, sprint, jump, and crouch
function setupKeyboardInput(movement) {
  const onKeyDown = (e) => {
    if (e.code === "KeyW") movement.forward = true;
    if (e.code === "KeyS") movement.backward = true;
    if (e.code === "KeyA") movement.left = true;
    if (e.code === "KeyD") movement.right = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight")
      movement.sprint = true;
    if (e.code === "Space") movement.jump = true;
    if (e.code === "ControlLeft" || e.code === "ControlRight")
      movement.crouch = true;
  };

  const onKeyUp = (e) => {
    if (e.code === "KeyW") movement.forward = false;
    if (e.code === "KeyS") movement.backward = false;
    if (e.code === "KeyA") movement.left = false;
    if (e.code === "KeyD") movement.right = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight")
      movement.sprint = false;
    if (e.code === "Space") movement.jump = false;
    if (e.code === "ControlLeft" || e.code === "ControlRight")
      movement.crouch = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

// Create the physics capsule collider for the player
// This is what detects collisions between the player and the world
function createPlayerCollider(scene, physics, playerStart, capsuleRadius, PLAYER_HEIGHT) {
  const playerCapsuleHeight = Math.max(0, PLAYER_HEIGHT - 2 * capsuleRadius);

  const playerCollider = physics.add.capsule(
    {
      radius: capsuleRadius,
      height: playerCapsuleHeight,
      ...playerStart,
      mass: 80,
    },
    { lambert: { color: 0x00ff00, transparent: true, opacity: 0 } },
  );

  playerCollider.userData.selectable = false;

  // Make the capsule invisible (it's just for collision, not rendering)
  const playerMaterials = Array.isArray(playerCollider.material)
    ? playerCollider.material
    : [playerCollider.material];
  playerMaterials.forEach((mat) => {
    if (!mat) return;
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
  });

  // Configure physics properties to keep the capsule upright and responsive
  if (playerCollider.body) {
    playerCollider.body.setAngularFactor(0, 1, 0);
    if (typeof playerCollider.body.setDamping === "function") {
      playerCollider.body.setDamping(0.01, 0.99);
    }
  }

  // Prevent the player from bouncing
  if (playerCollider.body &&
    typeof playerCollider.body.setRestitution === "function") {
    playerCollider.body.setRestitution(0);
  }

  // Configure swept sphere radius for better collision detection
  // This prevents the player from falling through geometry
  if (playerCollider.body && playerCollider.body.ammo) {
    const ammoBody = playerCollider.body.ammo;
    ammoBody.setCcdMotionThreshold(capsuleRadius * 0.5);
    ammoBody.setCcdSweptSphereRadius(capsuleRadius * 0.8);

    const shape = ammoBody.getCollisionShape();
    if (shape && shape.setMargin) {
      shape.setMargin(0.04);
    }
  }

  scene.add(playerCollider);
  return playerCollider;
}

export async function createPlayer({
  scene,
  physics,
  heightBounds = { min: 0, max: 10 },
  terrainData = null,
  camera,
  renderer,
  capsuleRadius = 0.4,
  floorLevel = 0,
  playerOptions = {},
  spawnPosition = null,
} = {}) {
  if (!scene || !physics || !camera || !renderer) {
    throw new Error(
      "createPlayer requires scene, physics, camera and renderer",
    );
  }

  // Configure player movement and camera settings
  const PLAYER_HEIGHT = playerOptions.playerHeight ?? 1.6;
  const JUMP_SPEED = playerOptions.jumpSpeed ?? 5;
  const WALK_ACCELERATION = playerOptions.walkAcceleration ?? 5;
  const SPRINT_ACCELERATION = playerOptions.sprintAcceleration ?? 10;
  const MOVEMENT_DAMPING = 20;
  const CAMERA_Y_OFFSET = playerOptions.cameraYOffset ?? 0;
  const CROUCH_OFFSET = 0.5;

  // Track current input state
  const movement = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    canJump: true,
    sprint: false,
    crouch: false,
  };

  // State for sitting in chairs/vehicles
  let isSeated = false;
  let seatedPosition = null;

  // Track the last time the player was on the ground for jump timing
  let lastGroundedAt = 0;

  // Set up keyboard input
  setupKeyboardInput(movement);

  // Calculate where the player should spawn
  const playerCapsuleHeight = Math.max(0, PLAYER_HEIGHT - 2 * capsuleRadius);
  const defaultY =
    (heightBounds.max ?? 0) +
    Math.max(playerCapsuleHeight, PLAYER_HEIGHT) / 2 +
    1;

  const playerStart = {
    x: spawnPosition?.x ?? 0,
    z: spawnPosition?.z ?? 0,
    y: typeof spawnPosition?.y === "number" ? spawnPosition.y : defaultY,
  };

  // Create the physics collider for the player
  const playerCollider = createPlayerCollider(scene, physics, playerStart, capsuleRadius, PLAYER_HEIGHT);

  const player = await firstPersonSetup(camera, renderer, {
    floorLevel,
    playerHeight: PLAYER_HEIGHT,
    gravity: 28,
    walkAcceleration: WALK_ACCELERATION,
    sprintAcceleration: SPRINT_ACCELERATION,
    movementDamping: MOVEMENT_DAMPING,
    jumpSpeed: JUMP_SPEED,
    terrainBounds: heightBounds,
    terrainData,
    dynamicCapsule: playerCollider,
  });

  const forwardDir = new THREE.Vector3();
  const rightDir = new THREE.Vector3();
  const movementVelocity = new THREE.Vector3();

  // Update player position and movement each frame
  // This handles movement input, jumping, falling, and camera positioning
  function update(delta) {
    // If the controls aren't ready, wait
    if (
      !playerCollider ||
      !player ||
      !player.controls ||
      !player.controls.isLocked
    ) {
      return;
    }

    // When seated (in a chair or vehicle), lock position and velocity
    if (isSeated && seatedPosition) {
      camera.position.set(seatedPosition.x, seatedPosition.y, seatedPosition.z);
      if (player.controls.getObject) {
        player.controls.getObject().position.copy(camera.position);
      }
      const body = playerCollider.body;
      if (body) {
        body.setVelocity(0, 0, 0);
        body.setAngularVelocity(0, 0, 0);
      }
      playerCollider.position.set(
        seatedPosition.x,
        seatedPosition.y - CAMERA_Y_OFFSET,
        seatedPosition.z,
      );
      return;
    }

    // Calculate movement direction based on camera orientation
    // This makes WASD movement relative to where the player is looking
    camera.getWorldDirection(forwardDir);
    forwardDir.y = 0;
    forwardDir.normalize();
    rightDir.crossVectors(forwardDir, camera.up).normalize();

    // Build movement velocity from input
    movementVelocity.set(0, 0, 0);
    const speed = movement.sprint ? SPRINT_ACCELERATION : WALK_ACCELERATION;
    if (movement.forward) movementVelocity.add(forwardDir);
    if (movement.backward) movementVelocity.sub(forwardDir);
    if (movement.left) movementVelocity.sub(rightDir);
    if (movement.right) movementVelocity.add(rightDir);
    if (movementVelocity.lengthSq() > 0) {
      movementVelocity.normalize().multiplyScalar(speed);
    }

    // Apply movement and jumping physics
    const body = playerCollider.body;
    if (body) {
      // If the player falls too far, reset them
      const minY = (heightBounds?.min ?? -10) - 30;
      if (playerCollider.position.y < minY) {
        console.warn("[Player] Fell through ground, resetting position");
        body.setVelocity(0, 0, 0);
        if (body.ammo) {
          const transform = new Ammo.btTransform();
          transform.setIdentity();
          transform.setOrigin(
            new Ammo.btVector3(playerStart.x, playerStart.y + 2, playerStart.z),
          );
          body.ammo.setWorldTransform(transform);
          body.ammo.getMotionState().setWorldTransform(transform);
          body.ammo.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
          body.ammo.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
          body.ammo.activate();
        }
        playerCollider.position.set(
          playerStart.x,
          playerStart.y + 2,
          playerStart.z,
        );
        body.needUpdate = true;
      }

      // Apply horizontal movement (X and Z), but keep vertical velocity
      const currentVel = body.velocity;
      body.setVelocity(movementVelocity.x, currentVel.y, movementVelocity.z);

      // Handle jumping - can only jump if recently on the ground
      const now = performance.now();
      const isGroundedNow = Math.abs(currentVel.y) < 1.0;
      if (isGroundedNow) lastGroundedAt = now;
      const canJumpNow = now - lastGroundedAt < 120;
      if (movement.jump && canJumpNow) {
        body.setVelocity(movementVelocity.x, JUMP_SPEED, movementVelocity.z);
        movement.jump = false;
        lastGroundedAt = 0;
      }
    }

    // Handle crouch - lowers the camera slightly
    const crouchAdjust = movement.crouch ? -CROUCH_OFFSET : 0;

    // Position the camera at the player's head
    camera.position.copy(playerCollider.position);
    if (CAMERA_Y_OFFSET) {
      camera.position.y += CAMERA_Y_OFFSET + crouchAdjust;
    }
    if (player.controls.getObject) {
      player.controls.getObject().position.copy(playerCollider.position);
      if (CAMERA_Y_OFFSET) {
        player.controls.getObject().position.y += CAMERA_Y_OFFSET + crouchAdjust;
      }
    }
  }

  // Move player to a seated position (for chairs, vehicles, etc.)
  function sitDown(position) {
    isSeated = true;
    seatedPosition = { ...position };
    const body = playerCollider.body;
    if (body) {
      body.setVelocity(0, 0, 0);
      body.setAngularVelocity(0, 0, 0);
    }
  }

  // Move player back to standing and update their position
  function standUp(position) {
    isSeated = false;
    seatedPosition = null;
    const body = playerCollider.body;
    if (body && body.ammo) {
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(
        new Ammo.btVector3(position.x, position.y, position.z),
      );
      body.ammo.setWorldTransform(transform);
      body.ammo.getMotionState().setWorldTransform(transform);
      body.ammo.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
      body.ammo.activate();
    }
    playerCollider.position.set(position.x, position.y, position.z);
  }

  // Check if player is currently seated
  function getIsSeated() {
    return isSeated;
  }

  // Return the player controller and its methods
  return {
    playerCollider,
    player,
    PLAYER_HEIGHT,
    movement,
    update,
    sitDown,
    standUp,
    getIsSeated,
  };
}
