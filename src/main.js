import * as THREE from "three";
import { createScene } from "./components/createScene.js";
import { createEnvironment } from "./components/createEnvironment.js";
import { createRooftop } from "./components/createRooftop.js";
import { createBoombox } from "./components/createBoombox.js";
import { createChair } from "./components/createChair.js";
import { createRecordBox } from "./components/createRecordBox.js";
import { createHeadphones } from "./components/createHeadphones.js";
import { createPhone } from "./components/createPhone.js";
import { createPlayer } from "./components/playerSetup.js";
import { createCar } from "./components/createCar.js";
import { loadBar, getBarSpawnPoint } from "./components/createBar.js";
import { createPortalGun } from "./components/createPortalGun.js";
import { createGarage } from "./components/createGarage.js";
import { createRick } from "./components/createRick.js";
import { getActiveInteraction } from "./components/createPrompt.js";
import { setupVRInput } from "./utils/vrInputSetup.js";
import { AmmoPhysics, PhysicsLoader } from "@enable3d/ammo-physics";
const DEBUG_LOG_MOVEMENT = false;

function createPerformanceHud(applyQuality, getQuality) {
  const hud = document.createElement("div");
  hud.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 200;
    color: white;
    background: black;
    border: 1px solid #666;
    border-radius: 5px;
    padding: 8px 12px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.4;
    pointer-events: none;
  `;
  document.body.appendChild(hud);

  const qualityOrder = ["high", "medium", "low"];
  let last = performance.now();
  let elapsed = 0;
  let frames = 0;

  document.addEventListener("keydown", (e) => {
    if (e.code !== "F2") return;
    const index = qualityOrder.indexOf(getQuality());
    const next = qualityOrder[(index + 1) % qualityOrder.length];
    applyQuality(next);
  });

  function update() {
    const now = performance.now();
    const dt = now - last;
    last = now;

    elapsed += dt;
    frames += 1;

    if (elapsed >= 500) {
      const fps = Math.round((frames * 1000) / elapsed);
      const ms = (elapsed / frames).toFixed(1);
      hud.textContent = `${fps} FPS  ${ms} ms  Quality: ${getQuality()}  (F2)`;
      elapsed = 0;
      frames = 0;
    }
  }

  return { update };
}

function createShadowOptimizer(scene, camera, getQuality) {
  // Track all meshes that cast/receive shadows
  const trackedMeshes = [];
  const tmpWorldPosition = new THREE.Vector3();

  // Find all meshes in the scene that have shadows enabled
  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.castShadow && !object.receiveShadow) return;

    trackedMeshes.push({
      mesh: object,
      baseCastShadow: object.castShadow,
      baseReceiveShadow: object.receiveShadow,
    });
  });

  let lastRefresh = 0;

  function update() {
    const now = performance.now();
    if (now - lastRefresh < 250) return; // Only check every 250ms
    lastRefresh = now;

    const quality = getQuality();

    // Determine shadow distance based on quality setting
    let maxDistance = 36; // Default for medium quality
    if (quality === "high") {
      maxDistance = 50;
    } else if (quality === "low") {
      maxDistance = 0; // No shadows for low quality
    }

    const maxDistanceSq = maxDistance * maxDistance;

    // Check each mesh and enable/disable shadows based on distance
    for (const entry of trackedMeshes) {
      const { mesh, baseCastShadow, baseReceiveShadow } = entry;

      mesh.getWorldPosition(tmpWorldPosition);
      const dx = camera.position.x - tmpWorldPosition.x;
      const dy = camera.position.y - tmpWorldPosition.y;
      const dz = camera.position.z - tmpWorldPosition.z;
      const distanceSq = dx * dx + dy * dy + dz * dz;

      // Only show shadows if object is close enough
      const inRange = quality !== "low" && distanceSq <= maxDistanceSq;

      mesh.castShadow = baseCastShadow && inRange;
      mesh.receiveShadow = baseReceiveShadow && inRange;
    }
  }

  return { update };
}
PhysicsLoader("/ammo", async () => {
  const clock = new THREE.Clock();

  const { scene, camera, renderer, applyQuality, getQuality } = createScene();
  const physics = new AmmoPhysics(scene);
  if (DEBUG_LOG_MOVEMENT) physics.debug?.enable();

  await createEnvironment(scene, renderer);
  const houseModel = await createRooftop(scene, physics);

  const playerSpawn = { x: 9, y: 11, z: 1 };

  const playerController = await createPlayer({
    scene,
    physics,
    heightBounds: { min: -250, max: 15 },
    terrainData: null,
    camera,
    renderer,
    capsuleRadius: 0.3,
    playerOptions: {
      walkAcceleration: 4,
      sprintAcceleration: 8,
      jumpSpeed: 5,
      playerHeight: 1.6,
      cameraYOffset: 0.5,
    },
    spawnPosition: playerSpawn,
  });

  const { update: updatePlayer } = playerController;

  // Set up VR controller input
 
  setupVRInput(renderer, playerController);
  const { update: updateHeadphones, getIsWearing } = await createHeadphones(scene, camera);
  const boomboxController = await createBoombox(scene, camera, getIsWearing);
  const { update: updateBoombox } = boomboxController;
  const { update: updateChair, getIsSeated } = await createChair(scene, camera, playerController);
  const { update: updateRecordBox } = await createRecordBox(scene, camera);
  const { update: updatePhone } = await createPhone(scene, camera, boomboxController);

  let updatePortalGun = () => {}; // Will be set when bar loads
  let updateRick = () => {}; // Will be set when bar loads
  let updateGarage = () => {}; // Will be set when garage loads
  let garageState = { morty: null }; // Track garage objects

  const { update: updateCar } = createCar(houseModel, camera, playerController, async () => {
    await loadBar(scene, physics);
    const { update: updatePG, setOnUse } = await createPortalGun(scene, camera);
    const rick = await createRick(scene, physics, camera);
    const { update: updateR } = rick;
    updatePortalGun = updatePG;
    updateRick = updateR;
    const barSpawn = getBarSpawnPoint();
    playerController.standUp(barSpawn);

    // Setup portal gun to load garage when used
    setOnUse(async () => {
      const { update: updateG, morty } = await createGarage(scene, camera, playerController, physics);
      updateGarage = updateG;
      garageState.morty = morty;
      console.log("[Main] Garage loaded with Morty");
    });

    // Make Rick interactive with 'E' key
    window.rickCharacter = rick;
  });

  const { update: updateHud } = createPerformanceHud(applyQuality, getQuality);
  const { update: updateShadows } = createShadowOptimizer(scene, camera, getQuality);

  // Rick interaction listener
  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!window.rickCharacter) return;

    // Only allow interaction if rick prompt is active or dialog is open
    const activeInteraction = getActiveInteraction();
    if (activeInteraction !== "rick" && !window.rickCharacter.isDialogOpen()) return;

    const playerPos = camera.position;
    const rickPos = window.rickCharacter.model.position;
    const distance = playerPos.distanceTo(rickPos);

    if (distance < 10) {
      window.rickCharacter.interact();
    }
  });

  // Morty interaction listener
  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!garageState.morty) return;

    // Only allow interaction if morty prompt is active or dialog is open
    const activeInteraction = getActiveInteraction();
    if (activeInteraction !== "morty" && !garageState.morty.isDialogOpen()) return;

    const playerPos = camera.position;
    const mortyPos = garageState.morty.model.position;
    const distance = playerPos.distanceTo(mortyPos);

    if (distance < 10) {
      garageState.morty.interact();
    }
  });

  renderer.setAnimationLoop(() => {
    // Main frame update loop.
    const delta = clock.getDelta();

    updatePlayer(delta);
    updateHeadphones();
    updateBoombox();
    updateChair();
    updateRecordBox();
    updatePhone();
    updateCar();
    updatePortalGun();
    updateRick(delta);
    updateGarage(delta);
    updateShadows();
    updateHud();
    physics.update(delta * 1000);
    if (DEBUG_LOG_MOVEMENT) physics.updateDebugger();

    renderer.render(scene, camera);
  });
});