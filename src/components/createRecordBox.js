import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { registerPrompt, clearPrompt, getActiveInteraction } from "./createPrompt.js";
import { isLookingAt } from "./createControls.js";
import "../styles/recordBox.css";

// Create an interactive record box that plays music from a playlist
// The record box has a UI for selecting tracks and shows album art
const ALBUM_PASSWORD = import.meta.env.VITE_ALBUM_PASSWORD || "";
const LOCKED_TRACKS_RAW = import.meta.env.VITE_LOCKED_TRACKS || "";

const LOCKED_TRACKS = LOCKED_TRACKS_RAW.split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

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
  let lockedTracksUnlocked = ALBUM_PASSWORD.length === 0;
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
  function selectCurrentTrack() {
    const track = TRACKS[currentIndex];
    if (isLockedTrack(track) && !unlockLockedTracks()) return;
    selectedTrack = track;
    selectBtn.innerText = "Selected - take to boombox";
    closeUI();
  }
  selectBtn.addEventListener("click", selectCurrentTrack);
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
    z-index: 50;
  `;
  document.body.appendChild(nowPlaying);
  function updateDisplay() {
    const track = TRACKS[currentIndex];
    const isLocked = isLockedTrack(track);
    const hideInfo = isLocked && !lockedTracksUnlocked;
    artImg.src = track.art;
    trackTitle.innerText = hideInfo ? "???" : track.title;
    trackArtist.innerText = hideInfo ? "???" : track.artist;
    counter.innerText = `${currentIndex + 1} / ${TRACKS.length}`;

    if (selectedTrack && selectedTrack.file === track.file) {
      selectBtn.innerText = "Selected - take to boombox";
    } else if (isLocked && !lockedTracksUnlocked) {
      selectBtn.innerText = "Locked song - enter password";
    } else {
      selectBtn.innerText = "Select this record";
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
    uiOpen = true;
    window.__recordBoxUiOpen = true;
    document.exitPointerLock();
  }

  function closeUI() {
    ui.style.display = "none";
    uiOpen = false;
    window.__recordBoxUiOpen = false;
  }

  function unlockLockedTracks() {
    if (lockedTracksUnlocked) return true;

    const input = window.prompt("Enter album password");
    if (input === null) return false;

    if (input !== ALBUM_PASSWORD) {
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
      if (e.code === "Enter" || e.code === "Space") {
        selectCurrentTrack();
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
      registerPrompt("recordbox", "Press E to browse records", 3);
    } else {
      clearPrompt("recordbox");
    }
  }

  return { recordBox, update, nowPlaying };
}
