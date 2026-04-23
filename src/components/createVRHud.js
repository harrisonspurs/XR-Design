import * as THREE from "three";
import { getActivePromptMessage } from "./createPrompt.js";

const HUD_DISTANCE = 2;
const HUD_DISTANCE_UI = 1.4;

const tmpOrigin = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpEnd = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

export function createVRHud(scene, camera) {
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.007, 0.012, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
    }),
  );
  reticle.renderOrder = 9998;
  reticle.visible = false;
  reticle.userData.vrHudIgnore = true;
  scene.add(reticle);

  const linePositions = new Float32Array(6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: false,
    }),
  );
  line.renderOrder = 9997;
  line.visible = false;
  line.userData.vrHudIgnore = true;
  scene.add(line);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 256;
  const labelContext = labelCanvas.getContext("2d");
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.needsUpdate = true;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  label.scale.set(1.5, 0.36, 1);
  label.renderOrder = 9999;
  label.visible = false;
  label.userData.vrHudIgnore = true;
  scene.add(label);

  let lastLabelText = "";
  let lastLabelActive = false;

  function update() {
    const ray = window.__vrLookRay;
    const isVr = !!window.__vrIsPresenting;

    if (!isVr || !ray?.origin || !ray?.direction) {
      reticle.visible = false;
      line.visible = false;
      label.visible = false;
      return;
    }

    tmpOrigin.set(ray.origin.x, ray.origin.y, ray.origin.z);
    tmpDirection.set(ray.direction.x, ray.direction.y, ray.direction.z).normalize();
    const distance = window.__recordBoxUiOpen ? HUD_DISTANCE_UI : HUD_DISTANCE;
    tmpEnd.copy(tmpOrigin).addScaledVector(tmpDirection, distance);

    reticle.visible = true;
    reticle.position.copy(tmpEnd);
    reticle.lookAt(tmpOrigin);

    const promptMessage = getActivePromptMessage();
    const hasActivePrompt = !!promptMessage;
    const isRecordUiOpen = !!window.__recordBoxUiOpen;

    line.visible = hasActivePrompt || isRecordUiOpen;
    linePositions[0] = tmpOrigin.x;
    linePositions[1] = tmpOrigin.y;
    linePositions[2] = tmpOrigin.z;
    linePositions[3] = tmpEnd.x;
    linePositions[4] = tmpEnd.y;
    linePositions[5] = tmpEnd.z;
    lineGeometry.attributes.position.needsUpdate = true;

    const recordUiLabel = window.__recordBoxUiLabel || "";
    const labelText =
      isRecordUiOpen ?
        `${recordUiLabel || "Record Box"}  |  A/X next  B/Y prev  Trigger select  Grip close`
      : hasActivePrompt ?
        promptMessage
      : "";

    if (labelText !== lastLabelText || hasActivePrompt !== lastLabelActive) {
      drawLabel(labelContext, labelCanvas, labelText, hasActivePrompt);
      labelTexture.needsUpdate = true;
      lastLabelText = labelText;
      lastLabelActive = hasActivePrompt;
    }

    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    label.visible = !!labelText;
    if (label.visible) {
      label.position.copy(tmpEnd).addScaledVector(tmpUp, 0.16);
    }

    const color = hasActivePrompt ? 0xffa357 : 0xffffff;
    reticle.material.color.setHex(color);
    line.material.color.setHex(color);
    line.material.opacity = hasActivePrompt ? 0.65 : 0.4;
  }

  return { update };
}

function drawLabel(ctx, canvas, text, active) {
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = active ? "rgba(20, 12, 6, 0.86)" : "rgba(0, 0, 0, 0.76)";
  roundRect(ctx, 12, 48, width - 24, height - 96, 28);
  ctx.fill();

  ctx.font = "bold 46px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = active ? "#ffd9b5" : "#f3f3f3";
  ctx.fillText(text, width / 2, height / 2);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
