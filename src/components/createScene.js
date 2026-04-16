import * as THREE from "three";

// Create the main THREE.js scene, camera, and renderer for the 3D world
export function createScene() {
  // Initialize the scene
  const scene = new THREE.Scene();

  // Set up the camera with a 75 degree field of view
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Position the camera at the starting viewpoint
  camera.position.set(9, 10.5, 1);

  // Create the WebGL renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Set up color space and tone mapping for realistic lighting
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  let currentQuality = "high";

  // Apply quality settings based on performance mode
  // This was tricky to get right - I had to experiment with different shadow types
  // to find what looked good without being too demanding
  function applyQuality(quality = "high") {
    let pixelRatioCap = 2;
    let shadowsEnabled = true;
    let shadowType = THREE.PCFSoftShadowMap;
    let exposure = 1.25;

    // Adjust settings based on quality level
    if (quality === "medium") {
      pixelRatioCap = 1.5;
      shadowType = THREE.PCFShadowMap;
      exposure = 1.2;
    } else if (quality === "low") {
      pixelRatioCap = 1;
      shadowsEnabled = false;
      shadowType = THREE.BasicShadowMap;
      exposure = 1.1;
    }

    // Apply the selected quality settings
    currentQuality = quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.shadowMap.enabled = shadowsEnabled;
    renderer.shadowMap.type = shadowType;
    renderer.toneMappingExposure = exposure;
  }

  // Set initial quality to high
  applyQuality(currentQuality);

  // Add the renderer to the page
  document.body.appendChild(renderer.domElement);

  // Handle window resizing to keep the canvas proportional
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