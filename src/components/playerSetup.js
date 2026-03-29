import * as THREE from "three";
import { firstPersonSetup } from "./firstPersonSetup.js";

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

  const PLAYER_HEIGHT = playerOptions.playerHeight ?? 1.6;
  const JUMP_SPEED = playerOptions.jumpSpeed ?? 5;
  const WALK_ACCELERATION = playerOptions.walkAcceleration ?? 5;
  const SPRINT_ACCELERATION = playerOptions.sprintAcceleration ?? 10;
  const MOVEMENT_DAMPING = 20;
  const CAMERA_Y_OFFSET = playerOptions.cameraYOffset ?? 0;
  const CROUCH_OFFSET = 0.5;

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

  // Seated state - when seated, physics is disabled and position is fixed
  let isSeated = false;
  let seatedPosition = null;

  let lastGroundedAt = 0;

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

  let playerCapsuleHeight = Math.max(0, PLAYER_HEIGHT - 2 * capsuleRadius);

  const defaultY =
    (heightBounds.max ?? 0) +
    Math.max(playerCapsuleHeight, PLAYER_HEIGHT) / 2 +
    1;

  const playerStart = {
    x: spawnPosition?.x ?? 0,
    z: spawnPosition?.z ?? 0,
    y: typeof spawnPosition?.y === "number" ? spawnPosition.y : defaultY,
  };

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

  const playerMaterials =
    Array.isArray(playerCollider.material) ?
      playerCollider.material
    : [playerCollider.material];
  playerMaterials.forEach((mat) => {
    if (!mat) return;
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
  });

  if (playerCollider.body) {
    playerCollider.body.setAngularFactor(0, 1, 0);
    if (typeof playerCollider.body.setDamping === "function") {
      playerCollider.body.setDamping(0.01, 0.99);
    }
  }

  if (
    playerCollider.body &&
    typeof playerCollider.body.setRestitution === "function"
  ) {
    playerCollider.body.setRestitution(0);
  }

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

  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _velocity = new THREE.Vector3();

  function update(delta) {
    if (
      !playerCollider ||
      !player ||
      !player.controls ||
      !player.controls.isLocked
    ) {
      return;
    }

    // If seated, lock position and skip physics movement
    if (isSeated && seatedPosition) {
      camera.position.set(seatedPosition.x, seatedPosition.y, seatedPosition.z);
      if (player.controls.getObject) {
        player.controls.getObject().position.copy(camera.position);
      }
      // Keep capsule at seated position but frozen
      const body = playerCollider.body;
      if (body) {
        body.setVelocity(0, 0, 0);
        body.setAngularVelocity(0, 0, 0);
      }
      playerCollider.position.set(seatedPosition.x, seatedPosition.y - CAMERA_Y_OFFSET, seatedPosition.z);
      return;
    }

    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, camera.up).normalize();

    _velocity.set(0, 0, 0);
    const speed = movement.sprint ? SPRINT_ACCELERATION : WALK_ACCELERATION;
    if (movement.forward) _velocity.add(_forward);
    if (movement.backward) _velocity.sub(_forward);
    if (movement.left) _velocity.sub(_right);
    if (movement.right) _velocity.add(_right);
    if (_velocity.lengthSq() > 0) _velocity.normalize().multiplyScalar(speed);

    const body = playerCollider.body;
    if (body) {
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

      const currentVel = body.velocity;
      body.setVelocity(_velocity.x, currentVel.y, _velocity.z);
      const now = performance.now();
      const isGroundedNow = Math.abs(currentVel.y) < 1.0;
      if (isGroundedNow) lastGroundedAt = now;
      const canJumpNow = now - lastGroundedAt < 120;
      if (movement.jump && canJumpNow) {
        body.setVelocity(_velocity.x, JUMP_SPEED, _velocity.z);
        movement.jump = false;
        lastGroundedAt = 0;
      }
    }

    // Apply crouch offset to camera
    const crouchAdjust = movement.crouch ? -CROUCH_OFFSET : 0;

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

  // Functions to control seated state from outside (e.g., chair)
  function sitDown(position) {
    isSeated = true;
    seatedPosition = { ...position };
    // Stop physics movement
    const body = playerCollider.body;
    if (body) {
      body.setVelocity(0, 0, 0);
      body.setAngularVelocity(0, 0, 0);
    }
  }

  function standUp(position) {
    isSeated = false;
    seatedPosition = null;
    // Move capsule to stand position
    const body = playerCollider.body;
    if (body && body.ammo) {
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
      body.ammo.setWorldTransform(transform);
      body.ammo.getMotionState().setWorldTransform(transform);
      body.ammo.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
      body.ammo.activate();
    }
    playerCollider.position.set(position.x, position.y, position.z);
  }

  function getIsSeated() {
    return isSeated;
  }

  return { playerCollider, player, PLAYER_HEIGHT, movement, update, sitDown, standUp, getIsSeated };
}
