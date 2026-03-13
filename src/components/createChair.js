import { loadModel } from "./modelLoader.js";

export async function createChair(scene, camera) {

  const chair = await loadModel(scene, "/models/low-poly_lawn_chair.glb", {
    position: { x: 10.5, y: 9, z: -1 },
    scale: 0.6,
    rotate: Math.PI,
  });

  const SEATED_POSITION = { x: 10.5, y: 10.3, z: -1 };
  const STAND_POSITION  = { x: 10.5, y: 10.5, z: 1 };

  let isSeated = false;

  const prompt = document.createElement("div");
  prompt.innerText = "Press E to sit down";
  prompt.style.cssText = `
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-family: sans-serif;
    font-size: 16px;
    background: rgba(0,0,0,0.6);
    padding: 10px 20px;
    border-radius: 20px;
    pointer-events: none;
    display: none;
  `;
  document.body.appendChild(prompt);

  document.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (!chair) return;

    const distance = camera.position.distanceTo(chair.position);

    if (!isSeated && distance <= 3) {
      camera.position.set(SEATED_POSITION.x, SEATED_POSITION.y, SEATED_POSITION.z);
      isSeated = true;
      prompt.innerText = "Press E to stand up";
      return;
    }

    if (isSeated) {
      camera.position.set(STAND_POSITION.x, STAND_POSITION.y, STAND_POSITION.z);
      isSeated = false;
      prompt.innerText = "Press E to sit down";
    }
  });

  function update() {
    if (!chair) return;
    const distance = camera.position.distanceTo(chair.position);
    prompt.style.display = (distance <= 3 || isSeated) ? "block" : "none";
  }

  return { chair, update, getIsSeated: () => isSeated };
}