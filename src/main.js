import * as THREE from "three";
import { createScene } from "./components/createScene.js";
import { createEnvironment } from "./components/createEnvironment.js";
import { createControls } from "./components/createControls.js";
import { createRooftop } from "./components/createRooftop.js";
import { createBoombox } from "./components/createBoombox.js";
import { createChair } from "./components/createChair.js";
import { createCityscape } from "./components/createCityscape.js";
import { createRecordBox } from "./components/createRecordBox.js";

function createPerformanceHud(applyQuality, getQuality) {
  const hud = document.createElement("div");
  hud.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 200;
    color: #ffe8d1;
    background: rgba(0,0,0,0.6);
    border: 1px solid rgba(255, 140, 70, 0.35);
    border-radius: 10px;
    padding: 8px 10px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.45;
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
  const trackedMeshes = [];
  const tmpWorldPosition = new THREE.Vector3();

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
  const maxShadowDistance = {
    high: 50,
    medium: 36,
    low: 0,
  };

  function update() {
    const now = performance.now();
    if (now - lastRefresh < 250) return;
    lastRefresh = now;

    const quality = getQuality();
    const maxDistance = maxShadowDistance[quality] ?? 36;
    const maxDistanceSq = maxDistance * maxDistance;

    for (const entry of trackedMeshes) {
      const { mesh, baseCastShadow, baseReceiveShadow } = entry;

      mesh.getWorldPosition(tmpWorldPosition);
      const dx = camera.position.x - tmpWorldPosition.x;
      const dy = camera.position.y - tmpWorldPosition.y;
      const dz = camera.position.z - tmpWorldPosition.z;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      const inRange = quality !== "low" && distanceSq <= maxDistanceSq;

      mesh.castShadow = baseCastShadow && inRange;
      mesh.receiveShadow = baseReceiveShadow && inRange;
    }
  }

  return { update };
}

async function init() {
  const { scene, camera, renderer, applyQuality, getQuality } = createScene();
  await createEnvironment(scene, renderer);
  const { update: updateBoombox } = await createBoombox(scene, camera);
  const { update: updateChair, getIsSeated } = await createChair(scene, camera);
  const { update: updateRecordBox } = await createRecordBox(scene, camera);
  await createRooftop(scene);
  createCityscape(scene);
  const { update: updateControls } = createControls(camera, renderer, getIsSeated);
  const { update: updateHud } = createPerformanceHud(applyQuality, getQuality);
  const { update: updateShadows } = createShadowOptimizer(scene, camera, getQuality);

  renderer.setAnimationLoop(() => {
    updateControls();
    updateBoombox();
    updateChair();
    updateRecordBox();
    updateShadows();
    updateHud();
    renderer.render(scene, camera);
  });
}

init().catch(console.error);