import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import "../styles/recordBox.css";

// Create an interactive record box that plays music from a playlist
// The record box has a UI for selecting tracks and shows album art
const ALBUM_PASSWORD = (import.meta.env.VITE_ALBUM_PASSWORD || "").trim();
const ALBUM_PASSWORD_HASH = (import.meta.env.VITE_ALBUM_PASSWORD_HASH || "")
  .trim()
  .toLowerCase();
const LOCKED_TRACKS_RAW = import.meta.env.VITE_LOCKED_TRACKS || "";
const DEFAULT_LOCKED_TRACKS = [
  "bologni_interlude_-_white2pac_klickaud.mp3",
  "1am_freestyle_klickaud.mp3",
  "tennessee_klickaud.mp3",
  "reunite_klickaud.mp3",
  "education_klickaud.mp3",
  "boovy_meat_klickaud.mp3",
];

const LOCKED_TRACKS_FROM_ENV = LOCKED_TRACKS_RAW.split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);
const LOCKED_TRACKS =
  LOCKED_TRACKS_RAW.trim().toLowerCase() === "none" ? [] :
  LOCKED_TRACKS_FROM_ENV.length > 0 ? LOCKED_TRACKS_FROM_ENV
  : DEFAULT_LOCKED_TRACKS;
const HAS_LOCKED_TRACKS = LOCKED_TRACKS.length > 0;
const HAS_UNLOCK_CONFIG = !!(ALBUM_PASSWORD || ALBUM_PASSWORD_HASH);

// Helper function to extract filename from a path
function getFileName(path) {
  if (!path) return "";
  const parts = path.split("/");
  return (parts[parts.length - 1] || "").toLowerCase();
}

// Check if a track is locked
function isLockedTrack(track) {
  const fileName = getFileName(track?.file);
  return LOCKED_TRACKS.includes(fileName);
}

const TRACKS = [
  {
    title: "'Til Infinity",
    artist: "Souls of Mischief",
    file: "/audio/93 'Til Infinity_spotdown.org.mp3",
    art: "/textures/albums/til-infinity.jpg",
  },
  {
    title: "C.R.E.A.M.",
    artist: "Wu-Tang Clan",
    file: "/audio/C.R.E.A.M. (Cash Rules Everything Around ...spotdown.org.mp3",
    art: "/textures/albums/cream.jpg",
  },
  {
    title: "Drop",
    artist: "Pharcyde",
    file: "/audio/Drop_spotdown.org.mp3",
    art: "/textures/albums/drop.jpg",
  },
  {
    title: "Gas Drawls",
    artist: "MF Doom",
    file: "/audio/Gas Drawls_spotdown.org.mp3",
    art: "/textures/albums/gas-drawls.jpg",
  },
  {
    title: "Mass Appeal",
    artist: "Gang Starr",
    file: "/audio/Mass Appeal_spotdown.org.mp3",
    art: "/textures/albums/mass-appeal.jpg",
  },
  {
    title: "Mathematics",
    artist: "Mos Def",
    file: "/audio/Mathematics_spotdown.org.mp3",
    art: "/textures/albums/mathematics.jpg",
  },
  {
    title: "Passin Me By",
    artist: "Pharcyde",
    file: "/audio/Passin-Me-By.mp3",
    art: "/textures/albums/passin-me-by.jpg",
  },
  {
    title: "Put It On",
    artist: "Big L",
    file: "/audio/Put It On_spotdown.org.mp3",
    art: "/textures/albums/put-it-on.jpg",
  },
  {
    title: "Street Talkin'",
    artist: "Various",
    file: "/audio/Street Talkin'_spotdown.org.mp3",
    art: "/textures/albums/street-talkin.jpg",
  },
  {
    title: "The Hop",
    artist: "Various",
    file: "/audio/The Hop_spotdown.org.mp3",
    art: "/textures/albums/the-hop.jpg",
  },
  {
    title: "Bologni Interlude - White2Pac",
    artist: "DWA Productions",
    file: "/audio/Bologni_Interlude_-_White2Pac_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
  {
    title: "1AM Freestyle",
    artist: "DWA Productions",
    file: "/audio/1AM_Freestyle_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
  {
    title: "Tennessee",
    artist: "DWA Productions",
    file: "/audio/Tennessee_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
  {
    title: "Reunite",
    artist: "DWA Productions",
    file: "/audio/Reunite_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
  {
    title: "Education",
    artist: "DWA Productions",
    file: "/audio/Education_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
  {
    title: "Boovy Meat",
    artist: "DWA Productions",
    file: "/audio/Boovy_Meat_KLICKAUD.mp3",
    art: "/textures/albums/dwa.png",
  },
];

export let selectedTrack = null;

export async function createRecordBox(scene, camera) {
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

  let interactionProxy = null;
  if (recordBox) {
    recordBox.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(recordBox);
    const size = worldBox.getSize(new THREE.Vector3());
    const center = worldBox.getCenter(new THREE.Vector3());
    const proxyGeometry = new THREE.BoxGeometry(
      Math.max(size.x * 0.9, 0.2),
      Math.max(size.y * 1.1, 0.2),
      Math.max(size.z * 0.9, 0.2),
    );
    const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
    interactionProxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    interactionProxy.position.copy(center);
    scene.add(interactionProxy);
  }
  let currentIndex = 0;
  let uiOpen = false;
  window.__recordBoxUiOpen = false;
  window.__recordBoxUiLabel = "";
  let lockedTracksUnlocked = !HAS_LOCKED_TRACKS;
  let isDragging = false;
  let dragStartX = 0;
  let lastLookCheckTime = 0;
  let cachedIsLooking = false;
  const ui = document.createElement("div");
  ui.className = "record-box-ui";
  document.body.appendChild(ui);
  const heading = document.createElement("div");
  heading.innerText = "Record Box";
  heading.className = "record-box-heading";
  ui.appendChild(heading);
  const controlsHint = document.createElement("div");
  controlsHint.style.cssText = `
    font-size: 12px;
    color: rgba(255,255,255,0.62);
    margin-top: -10px;
    margin-bottom: 16px;
    line-height: 1.4;
  `;
  ui.appendChild(controlsHint);
  const artContainer = document.createElement("div");
  artContainer.className = "record-box-art-container";
  ui.appendChild(artContainer);

  const artImg = document.createElement("img");
  artImg.className = "record-box-art-img";
  artContainer.appendChild(artImg);
  const trackTitle = document.createElement("div");
  trackTitle.className = "record-box-track-title";
  ui.appendChild(trackTitle);

  const trackArtist = document.createElement("div");
  trackArtist.className = "record-box-track-artist";
  ui.appendChild(trackArtist);
  const selectionStatus = document.createElement("div");
  selectionStatus.style.cssText = `
    font-size: 12px;
    color: rgba(255,200,140,0.92);
    margin-top: -8px;
    margin-bottom: 14px;
    min-height: 16px;
  `;
  ui.appendChild(selectionStatus);
  const navRow = document.createElement("div");
  navRow.className = "record-box-nav-row";
  ui.appendChild(navRow);

  function makeArrow(label, onClick) {
    const btn = document.createElement("div");
    btn.innerText = label;
    btn.className = "record-box-arrow-btn";
    btn.addEventListener("click", onClick);
    return btn;
  }

  const counter = document.createElement("div");
  counter.className = "record-box-counter";

  navRow.appendChild(makeArrow("<", () => navigate(-1)));
  navRow.appendChild(counter);
  navRow.appendChild(makeArrow(">", () => navigate(1)));
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
  selectBtn.addEventListener("mouseenter", () => {
    selectBtn.style.background = "rgba(255,150,50,1)";
  });
  selectBtn.addEventListener("mouseleave", () => {
    selectBtn.style.background = "rgba(255,150,50,0.8)";
  });
  async function selectCurrentTrack() {
    const track = TRACKS[currentIndex];
    if (isLockedTrack(track) && !(await unlockLockedTracks())) return;
    selectedTrack = track;
    selectBtn.innerText = "Selected - take to boombox";
    closeUI();
  }
  selectBtn.addEventListener("click", () => {
    void selectCurrentTrack();
  });
  ui.appendChild(selectBtn);
  const closeBtn = document.createElement("div");
  closeBtn.innerText = "X Close";
  closeBtn.style.cssText = `
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    margin-top: 4px;
  `;
  closeBtn.addEventListener("click", closeUI);
  ui.appendChild(closeBtn);
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
    z-index: 2200;
  `;
  document.body.appendChild(nowPlaying);
  function updateDisplay() {
    const track = TRACKS[currentIndex];
    const isLocked = isLockedTrack(track);
    const hideInfo = isLocked && !lockedTracksUnlocked;
    controlsHint.innerText = window.__vrIsPresenting ?
      "Stick left/right to browse | Trigger/A select | B/Grip close"
    : "Arrow keys browse | Enter select | Esc close";
    artImg.src = track.art;
    trackTitle.innerText = hideInfo ? "???" : track.title;
    trackArtist.innerText = hideInfo ? "???" : track.artist;
    counter.innerText = `${currentIndex + 1} / ${TRACKS.length}`;
    window.__recordBoxUiLabel =
      `Record ${currentIndex + 1}/${TRACKS.length}: ${hideInfo ? "???" : `${track.title} - ${track.artist}`}`;

    if (selectedTrack && selectedTrack.file === track.file) {
      selectBtn.innerText = "Selected - take to boombox";
      selectionStatus.innerText = "Currently selected";
    } else if (isLocked && !lockedTracksUnlocked) {
      selectBtn.innerText = "Locked song - enter password";
      selectionStatus.innerText = "Locked track";
    } else {
      selectBtn.innerText = "Select this record";
      selectionStatus.innerText = selectedTrack ?
        `Selected now: ${selectedTrack.title}`
      : "No record selected";
    }
  }

  function navigate(dir) {
    currentIndex = (currentIndex + dir + TRACKS.length) % TRACKS.length;
    updateDisplay();
  }
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
  function openUI() {
    updateDisplay();
    ui.style.display = "block";
    ui.style.zIndex = "2200";
    uiOpen = true;
    window.__recordBoxUiOpen = true;
    document.exitPointerLock();
  }

  function closeUI() {
    ui.style.display = "none";
    uiOpen = false;
    window.__recordBoxUiOpen = false;
    window.__recordBoxUiLabel = "";
  }

  async function unlockLockedTracks() {
    if (lockedTracksUnlocked) return true;
    if (!HAS_UNLOCK_CONFIG) {
      window.alert(
        "Locked tracks are enabled but no unlock password is configured. Add VITE_ALBUM_PASSWORD or VITE_ALBUM_PASSWORD_HASH to your .env and restart Vite.",
      );
      return false;
    }

    const input = window.prompt("Enter album password");
    if (input === null) return false;
    const candidate = input.trim();
    let valid = false;

    if (ALBUM_PASSWORD_HASH) {
      const candidateHash = await sha256Hex(candidate);
      valid = !!candidateHash && candidateHash === ALBUM_PASSWORD_HASH;
    } else {
      valid = candidate === ALBUM_PASSWORD;
    }

    if (!valid) {
      window.alert("Wrong password");
      return false;
    }

    lockedTracksUnlocked = true;
    return true;
  }

  document.addEventListener("keydown", (e) => {
    if (uiOpen) {
      if (e.code === "Escape" || e.code === "KeyE") {
        closeUI();
        return;
      }
      if (e.code === "ArrowLeft") {
        navigate(-1);
        return;
      }
      if (e.code === "ArrowRight") {
        navigate(1);
        return;
      }
      if (e.code === "KeyA") {
        navigate(-1);
        return;
      }
      if (e.code === "KeyD") {
        navigate(1);
        return;
      }
      if (e.code === "Enter" || e.code === "Space") {
        void selectCurrentTrack();
        return;
      }
    }

    if (e.code !== "KeyE") return;
    if (!recordBox) return;

    const active = getActiveInteraction();
    if (active !== "recordbox" && !uiOpen) {
      if (!window.__vrIsPresenting) return;
      const lookingAtRecordBox = interactionProxy
        ? isLookingAt(camera, interactionProxy, 4.5)
        : isLookingAt(camera, recordBox, 4);
      if (!lookingAtRecordBox) return;
    }

    const distance = camera.position.distanceTo(recordBox.position);
    if (distance > 4 && !uiOpen) return;

    openUI();
  });

  function update() {
    if (!recordBox) return;
    const distance = camera.position.distanceTo(recordBox.position);
    const now = performance.now();

    if (now - lastLookCheckTime > 80) {
      cachedIsLooking = interactionProxy
        ? isLookingAt(camera, interactionProxy, 4.5)
        : isLookingAt(camera, recordBox, 4);
      lastLookCheckTime = now;
    }

    if (!uiOpen && distance <= 4 && cachedIsLooking) {
      registerPrompt(
        "recordbox",
        window.__vrIsPresenting ?
          "Record Box: trigger/A to open"
        : "Press E to browse records",
        3,
      );
    } else {
      clearPrompt("recordbox");
    }
  }

  return { recordBox, update, nowPlaying };
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) return null;
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
