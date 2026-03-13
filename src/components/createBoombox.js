import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import * as RecordBox from "./createRecordBox.js";

export async function createBoombox(scene, camera) {

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

  const listener = new THREE.AudioListener();
  camera.add(listener);

  const sound = new THREE.PositionalAudio(listener);
  sound.setRefDistance(5);
  sound.setLoop(false);
  sound.setVolume(1.0);
  if (boombox) boombox.add(sound);

  const audioLoader = new THREE.AudioLoader();
  let isPlaying = false;
  let loadedTrackFile = null;

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

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!boombox) return;
    if (getActiveInteraction() !== "boombox") return;

    const track = RecordBox.selectedTrack;

    if (!track) {
      nowPlaying.innerText = "⚠️ Pick a record first";
      nowPlaying.style.display = "block";
      setTimeout(() => nowPlaying.style.display = "none", 3000);
      return;
    }

    if (isPlaying) {
      sound.pause();
      isPlaying = false;
      nowPlaying.innerText = `⏸ Paused — ${track.title}`;
      nowPlaying.style.display = "block";
      setTimeout(() => nowPlaying.style.display = "none", 2000);
      return;
    }

    if (loadedTrackFile === track.file && sound.buffer) {
      sound.play();
      isPlaying = true;
      nowPlaying.innerText = `♫ ${track.title} — ${track.artist}`;
      nowPlaying.style.display = "block";
      return;
    }

    audioLoader.load(track.file, (buffer) => {
      if (sound.isPlaying) sound.stop();
      sound.setBuffer(buffer);
      sound.play();
      isPlaying = true;
      loadedTrackFile = track.file;
      nowPlaying.innerText = `♫ ${track.title} — ${track.artist}`;
      nowPlaying.style.display = "block";
    });
  });

  function update() {
    if (!boombox) return;
    const distance = camera.position.distanceTo(boombox.position);
    const track = RecordBox.selectedTrack;

    if (distance <= 3 && isLookingAt(camera, boombox, 3)) {
      const msg = track
        ? `Press E to ${isPlaying ? "pause" : "play"} — ${track.title}`
        : "Press E — select a record first";
      registerPrompt("boombox", msg, 1);
    } else {
      clearPrompt("boombox");
    }
  }

  return { boombox, update };
}