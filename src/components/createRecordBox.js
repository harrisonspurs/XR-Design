// createRecordBox.js
// Interactive record box with album artwork carousel.
// Player browses records by clicking arrows or dragging.
// Selecting a record queues it — player then walks to boombox and presses E to play.
// This mimics the real-life experience of picking a record and putting it on.

import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";


// Tracklist — title, audio file, and album artwork
const TRACKS = [
  { title: "'Til Infinity",   artist: "Souls of Mischief", file: "/audio/93 'Til Infinity_spotdown.org.mp3",                        art: "/textures/albums/til-infinity.jpg" },
  { title: "C.R.E.A.M.",      artist: "Wu-Tang Clan",      file: "/audio/C.R.E.A.M. (Cash Rules Everything Around ...spotdown.org.mp3", art: "/textures/albums/cream.jpg" },
  { title: "Drop",            artist: "Pharcyde",          file: "/audio/Drop_spotdown.org.mp3",                                    art: "/textures/albums/drop.jpg" },
  { title: "Gas Drawls",      artist: "MF Doom",           file: "/audio/Gas Drawls_spotdown.org.mp3",                              art: "/textures/albums/gas-drawls.jpg" },
  { title: "Mass Appeal",     artist: "Gang Starr",        file: "/audio/Mass Appeal_spotdown.org.mp3",                             art: "/textures/albums/mass-appeal.jpg" },
  { title: "Mathematics",     artist: "Mos Def",           file: "/audio/Mathematics_spotdown.org.mp3",                             art: "/textures/albums/mathematics.jpg" },
  { title: "Passin Me By",    artist: "Pharcyde",          file: "/audio/Passin-Me-By.mp3",                                         art: "/textures/albums/passin-me-by.jpg" },
  { title: "Put It On",       artist: "Big L",             file: "/audio/Put It On_spotdown.org.mp3",                               art: "/textures/albums/put-it-on.jpg" },
  { title: "Street Talkin'",  artist: "Various",           file: "/audio/Street Talkin'_spotdown.org.mp3",                          art: "/textures/albums/street-talkin.jpg" },
  { title: "The Hop",         artist: "Various",           file: "/audio/The Hop_spotdown.org.mp3",                                 art: "/textures/albums/the-hop.jpg" },
];

// Shared selected track — boombox reads this to know what to play
export let selectedTrack = null;

export async function createRecordBox(scene, camera) {

  // ── Load Model ────────────────────────────────────────────────────────────
  const recordBox = await loadModel(scene, "/models/record_box.glb", {
    position: { x: 0, y: 0, z: 0 },
    scale: 0.07,
    rotate: 1.75,
  });

  if (recordBox) {
    const box = new THREE.Box3().setFromObject(recordBox);
    const center = box.getCenter(new THREE.Vector3());
    const bottom = box.min.y;
    recordBox.position.x = 6.75 - center.x;
    recordBox.position.z = 0 - center.z;
    recordBox.position.y = 9.1 - bottom;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let currentIndex = 0;
  let uiOpen = false;
  let isDragging = false;
  let dragStartX = 0;

  // ── UI Container ──────────────────────────────────────────────────────────
  const ui = document.createElement("div");
  ui.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(10,10,10,0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 30px 40px;
    display: none;
    z-index: 100;
    font-family: sans-serif;
    color: white;
    text-align: center;
    min-width: 340px;
    user-select: none;
  `;
  document.body.appendChild(ui);

  // Title
  const heading = document.createElement("div");
  heading.innerText = "🎵 Record Box";
  heading.style.cssText = `
    font-size: 16px;
    font-weight: bold;
    letter-spacing: 2px;
    margin-bottom: 24px;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
  `;
  ui.appendChild(heading);

  // ── Album Art ─────────────────────────────────────────────────────────────
  const artContainer = document.createElement("div");
  artContainer.style.cssText = `
    position: relative;
    width: 220px;
    height: 220px;
    margin: 0 auto 20px;
    cursor: grab;
  `;
  ui.appendChild(artContainer);

  const artImg = document.createElement("img");
  artImg.style.cssText = `
    width: 220px;
    height: 220px;
    object-fit: cover;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    display: block;
    pointer-events: none;
  `;
  artContainer.appendChild(artImg);

  // ── Track Info ────────────────────────────────────────────────────────────
  const trackTitle = document.createElement("div");
  trackTitle.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 4px;
  `;
  ui.appendChild(trackTitle);

  const trackArtist = document.createElement("div");
  trackArtist.style.cssText = `
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    margin-bottom: 24px;
  `;
  ui.appendChild(trackArtist);

  // ── Navigation Arrows ─────────────────────────────────────────────────────
  const navRow = document.createElement("div");
  navRow.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-bottom: 20px;
  `;
  ui.appendChild(navRow);

  function makeArrow(label, onClick) {
    const btn = document.createElement("div");
    btn.innerText = label;
    btn.style.cssText = `
      font-size: 28px;
      cursor: pointer;
      color: rgba(255,255,255,0.7);
      padding: 8px 16px;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      transition: background 0.2s;
    `;
    btn.addEventListener("mouseenter", () => btn.style.background = "rgba(255,150,50,0.3)");
    btn.addEventListener("mouseleave", () => btn.style.background = "rgba(255,255,255,0.05)");
    btn.addEventListener("click", onClick);
    return btn;
  }

  const counter = document.createElement("div");
  counter.style.cssText = `font-size: 13px; color: rgba(255,255,255,0.4);`;

  navRow.appendChild(makeArrow("◀", () => navigate(-1)));
  navRow.appendChild(counter);
  navRow.appendChild(makeArrow("▶", () => navigate(1)));

  // ── Select Button ─────────────────────────────────────────────────────────
  const selectBtn = document.createElement("div");
  selectBtn.style.cssText = `
    padding: 12px 28px;
    background: rgba(255,150,50,0.8);
    border-radius: 30px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    letter-spacing: 1px;
    margin-bottom: 16px;
    transition: background 0.2s;
  `;
  selectBtn.addEventListener("mouseenter", () => selectBtn.style.background = "rgba(255,150,50,1)");
  selectBtn.addEventListener("mouseleave", () => selectBtn.style.background = "rgba(255,150,50,0.8)");
  selectBtn.addEventListener("click", () => {
    selectedTrack = TRACKS[currentIndex];
    selectBtn.innerText = `✓ Selected — take to boombox`;
    closeUI();
  });
  ui.appendChild(selectBtn);

  // Close button
  const closeBtn = document.createElement("div");
  closeBtn.innerText = "✕ Close";
  closeBtn.style.cssText = `
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    margin-top: 4px;
  `;
  closeBtn.addEventListener("click", closeUI);
  ui.appendChild(closeBtn);

  // ── Now Playing Bar ───────────────────────────────────────────────────────
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

  // ── Update Display ────────────────────────────────────────────────────────
  function updateDisplay() {
    const track = TRACKS[currentIndex];
    artImg.src = track.art;
    trackTitle.innerText = track.title;
    trackArtist.innerText = track.artist;
    counter.innerText = `${currentIndex + 1} / ${TRACKS.length}`;

    if (selectedTrack && selectedTrack.file === track.file) {
      selectBtn.innerText = "✓ Selected — take to boombox";
    } else {
      selectBtn.innerText = "Select this record";
    }
  }

  function navigate(dir) {
    currentIndex = (currentIndex + dir + TRACKS.length) % TRACKS.length;
    updateDisplay();
  }

  // ── Drag to Flick ─────────────────────────────────────────────────────────
  artContainer.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    artContainer.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX;
    if (Math.abs(diff) > 60) {
      navigate(diff < 0 ? 1 : -1);
      dragStartX = e.clientX;
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    artContainer.style.cursor = "grab";
  });

  // ── Open / Close ──────────────────────────────────────────────────────────
  function openUI() {
    updateDisplay();
    ui.style.display = "block";
    uiOpen = true;
    document.exitPointerLock();
  }

  function closeUI() {
    ui.style.display = "none";
    uiOpen = false;
  }

  // ── E Key ─────────────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && uiOpen) { closeUI(); return; }
    if (e.code !== "KeyE") return;
    if (!recordBox) return;

    const active = getActiveInteraction();
    if (active !== "recordbox" && !uiOpen) return;

    const distance = camera.position.distanceTo(recordBox.position);
    if (distance > 4 && !uiOpen) return;

    uiOpen ? closeUI() : openUI();
  });

  // ── Update ────────────────────────────────────────────────────────────────
  function update() {
    if (!recordBox) return;
    const distance = camera.position.distanceTo(recordBox.position);
    if (!uiOpen && distance <= 4 && isLookingAt(camera, recordBox, 4)) {
      registerPrompt("recordbox", "Press E to browse records", 3);
    } else {
      clearPrompt("recordbox");
    }
 }

  return { recordBox, update, nowPlaying };
}