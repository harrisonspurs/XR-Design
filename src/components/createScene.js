import * as THREE from "three";

export function createScene() {

  const QUALITY_PRESETS = {
    high: {
      pixelRatioCap: 2,
      shadows: true,
      shadowType: THREE.PCFSoftShadowMap,
      toneMappingExposure: 1.25,
    },
    medium: {
      pixelRatioCap: 1.5,
      shadows: true,
      shadowType: THREE.PCFShadowMap,
      toneMappingExposure: 1.2,
    },
    low: {
      pixelRatioCap: 1,
      shadows: false,
      shadowType: THREE.BasicShadowMap,
      toneMappingExposure: 1.1,
    },
  };

  let currentQuality = "high";

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

camera.position.set(9, 10.5, 1);

  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);


  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  function applyQuality(quality = "high") {
    const selected = QUALITY_PRESETS[quality] ? quality : "high";
    const preset = QUALITY_PRESETS[selected];
    currentQuality = selected;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioCap));
    renderer.shadowMap.enabled = preset.shadows;
    renderer.shadowMap.type = preset.shadowType;
    renderer.toneMappingExposure = preset.toneMappingExposure;
  }

  applyQuality(currentQuality);

  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyQuality(currentQuality);
  });

  return {
    scene,
    camera,
    renderer,
    applyQuality,
    getQuality: () => currentQuality,
  };
}