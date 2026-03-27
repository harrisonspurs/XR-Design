import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import * as RecordBox from "./createRecordBox.js";

export async function createBoombox(scene, camera, getIsWearingHeadphones = () => false) {

  const boombox = await loadModel(scene, "/models/classic_boombox.glb", {
    position: { x: 2, y: 0.6, z: 3.2 },
    scale: 0.07,
    rotate: 1,
  });

  if (boombox) {
    const box = new THREE.Box3().setFromObject(boombox);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;
    boombox.position.x = 9 - center.x;
    boombox.position.z = 1 - center.z;
    boombox.position.y = 10.5 - bottom;
    boombox.children[0].children[0].children[1].material.color = new THREE.Color(0x8b4513);
  }

  const glowTargets = [];
  const glowColor = new THREE.Color(0xff5a1f);
  const mixedColor = new THREE.Color();

  const emissivePartMatchers = [
    "speaker",
    "ring",
    "cone",
    "display",
    "screen",
    "led",
    "light",
    "button",
    "dial",
  ];

  function shouldGlowPart(child, material) {
    const meshName = (child.name || "").toLowerCase();
    const materialName = (material?.name || "").toLowerCase();
    return emissivePartMatchers.some(
      (token) => meshName.includes(token) || materialName.includes(token)
    );
  }

  if (boombox) {
    boombox.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const sourceMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      const clonedMaterials = sourceMaterials.map((mat) => {
        if (!mat || !("emissive" in mat)) return mat;

        if (!shouldGlowPart(child, mat)) return mat;

        const clone = mat.clone();
        glowTargets.push({
          material: clone,
          baseEmissive: clone.emissive.clone(),
          baseIntensity: clone.emissiveIntensity ?? 1,
        });
        return clone;
      });

      child.material = Array.isArray(child.material)
        ? clonedMaterials
        : clonedMaterials[0];
    });
  }

  const glowLight = new THREE.PointLight(0xff6a2a, 0, 9.5, 1.5);
  const glowFillLight = new THREE.PointLight(0xff8a42, 0, 18, 1.05);
  if (boombox) {
    boombox.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(boombox);
    const size = worldBox.getSize(new THREE.Vector3());
    const anchorWorld = worldBox.getCenter(new THREE.Vector3());
    const fillWorld = worldBox.getCenter(new THREE.Vector3());

    anchorWorld.y = worldBox.max.y - size.y * 0.28;
    anchorWorld.z = worldBox.max.z - size.z * 0.12;
    fillWorld.y = worldBox.max.y + size.y * 0.15;
    fillWorld.z = worldBox.max.z - size.z * 0.05;

    glowLight.position.copy(boombox.worldToLocal(anchorWorld));
    glowFillLight.position.copy(boombox.worldToLocal(fillWorld));
    boombox.add(glowLight);
    boombox.add(glowFillLight);
  }

  const listener = new THREE.AudioListener();
  camera.add(listener);

  const speakerSound = new THREE.PositionalAudio(listener);
  speakerSound.setRefDistance(5);
  speakerSound.setLoop(false);
  speakerSound.setVolume(1.0);
  if (boombox) boombox.add(speakerSound);

  const headphoneSound = new THREE.Audio(listener);
  headphoneSound.setLoop(false);
  headphoneSound.setVolume(1.0);

  const speakerAnalyser = new THREE.AudioAnalyser(speakerSound, 64);
  const headphoneAnalyser = new THREE.AudioAnalyser(headphoneSound, 64);

  const audioLoader = new THREE.AudioLoader();
  let isPlaying = false;
  let loadedTrackFile = null;
  let smoothedAudioLevel = 0;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;
  let lastOutputMode = "speaker";

  function useHeadphonesOutput() {
    try {
      return !!getIsWearingHeadphones();
    } catch {
      return false;
    }
  }

  function getActiveSound() {
    return useHeadphonesOutput() ? headphoneSound : speakerSound;
  }

  function stopAllSounds() {
    if (speakerSound.isPlaying) speakerSound.stop();
    if (headphoneSound.isPlaying) headphoneSound.stop();
  }

  const nowPlaying = document.createElement("div");
  nowPlaying.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-family: sans-serif;
    font-size: 13px;
    background: rgba(0,0,0,0.75);
    padding: 6px 18px;
    border-radius: 20px;
    pointer-events: none;
    display: none;
    z-index: 50;
  `;
  document.body.appendChild(nowPlaying);

  const onTrackEnded = () => {
    isPlaying = false;
    nowPlaying.style.display = "none";
  };

  speakerSound.onEnded = onTrackEnded;
  headphoneSound.onEnded = onTrackEnded;

  function updateGlow() {
    if (!boombox) return;

    const averageFrequency = isPlaying
      ? Math.max(
        speakerAnalyser.getAverageFrequency(),
        headphoneAnalyser.getAverageFrequency()
      )
      : 0;
    const targetLevel = averageFrequency / 255;
    const smoothing = targetLevel > smoothedAudioLevel ? 0.32 : 0.08;
    smoothedAudioLevel = THREE.MathUtils.lerp(
      smoothedAudioLevel,
      targetLevel,
      smoothing
    );

    const microPulse = isPlaying ? 0.5 + 0.5 * Math.sin(performance.now() * 0.02) : 0;
    const energy = isPlaying ? Math.min(1, smoothedAudioLevel * 1.6 + microPulse * 0.15) : 0;

    const glowMix = isPlaying ? 0.22 + energy * 0.78 : 0;
    const glowIntensity = isPlaying ? 0.45 + energy * 2.45 : 0;

    glowTargets.forEach((target) => {
      mixedColor.copy(target.baseEmissive).lerp(glowColor, glowMix);
      target.material.emissive.copy(mixedColor);
      target.material.emissiveIntensity = target.baseIntensity + glowIntensity;
    });

    glowLight.intensity = isPlaying ? 1.6 + energy * 5.2 : 0;
    glowFillLight.intensity = isPlaying ? 1.0 + energy * 2.8 : 0;
  }

  function togglePlayback() {
    const activeSound = getActiveSound();
    const track = RecordBox.selectedTrack;

    if (!track) {
      nowPlaying.innerText = "⚠️ Pick a record first";
      nowPlaying.style.display = "block";
      setTimeout(() => nowPlaying.style.display = "none", 3000);
      return { ok: false, reason: "no-track" };
    }

    if (isPlaying) {
      if (speakerSound.isPlaying) speakerSound.pause();
      if (headphoneSound.isPlaying) headphoneSound.pause();
      isPlaying = false;
      nowPlaying.innerText = `⏸ Paused — ${track.title}`;
      nowPlaying.style.display = "block";
      setTimeout(() => nowPlaying.style.display = "none", 2000);
      return { ok: true, state: "paused", track };
    }

    if (loadedTrackFile === track.file && activeSound.buffer) {
      stopAllSounds();
      activeSound.play();
      isPlaying = true;
      nowPlaying.innerText = `♫ ${track.title} — ${track.artist}`;
      nowPlaying.style.display = "block";
      return { ok: true, state: "playing", track };
    }

    audioLoader.load(track.file, (buffer) => {
      stopAllSounds();
      speakerSound.setBuffer(buffer);
      headphoneSound.setBuffer(buffer);
      getActiveSound().play();
      isPlaying = true;
      loadedTrackFile = track.file;
      nowPlaying.innerText = `♫ ${track.title} — ${track.artist}`;
      nowPlaying.style.display = "block";
    });

    return { ok: true, state: "loading", track };
  }

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!boombox) return;
    if (getActiveInteraction() !== "boombox") return;
    togglePlayback();
  });

  function update() {
    updateGlow();

    if (!boombox) return;
    const distance = camera.position.distanceTo(boombox.position);
    const track = RecordBox.selectedTrack;

    const currentOutputMode = useHeadphonesOutput() ? "headphones" : "speaker";
    if (isPlaying && lastOutputMode !== currentOutputMode && speakerSound.buffer) {
      stopAllSounds();
      getActiveSound().play();
    }
    lastOutputMode = currentOutputMode;

    const now = performance.now();
    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = isLookingAt(camera, boombox, 3);
      lastLookCheckTime = now;
    }

    if (distance <= 3 && cachedIsLooking) {
      const msg = track
        ? `Press E to ${isPlaying ? "pause" : "play"} — ${track.title}`
        : "Press E — select a record first";
      registerPrompt("boombox", msg, 1);
    } else {
      clearPrompt("boombox");
    }
  }

  return {
    boombox,
    update,
    togglePlayback,
    getIsPlaying: () => isPlaying,
    getCurrentTrack: () => RecordBox.selectedTrack,
  };
}