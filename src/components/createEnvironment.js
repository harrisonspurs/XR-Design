
import * as THREE from "three";

export async function createEnvironment(scene, renderer) {

  const skyGeo = new THREE.SphereGeometry(450, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide, // render the inside of the sphere, not the outside
  });
  const topColour = new THREE.Color(0x1a0533);      // deep purple at the top
  const midColour = new THREE.Color(0xff6b35);      // warm orange in the middle
  const horizonColour = new THREE.Color(0xff9d7a);  // soft pink/peach at horizon
  const positions = skyGeo.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = (y + 450) / 900;

    let colour = new THREE.Color();

    if (t > 0.5) {
      colour.lerpColors(midColour, topColour, (t - 0.5) * 2);
    } else {
      colour.lerpColors(horizonColour, midColour, t * 2);
    }

    colors.push(colour.r, colour.g, colour.b);
  }

  skyGeo.setAttribute("color", new THREE.BufferAttribute(
    new Float32Array(colors), 3
  ));

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.fog = new THREE.FogExp2(0xff6b35, 0.005);
  const ambientLight = new THREE.AmbientLight(0xff9966, 1.5);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xff7733, 3);
  sunLight.position.set(-50, 40, -50); // low on the horizon
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -50;
  sunLight.shadow.camera.right = 50;
  sunLight.shadow.camera.top = 50;
  sunLight.shadow.camera.bottom = -50;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);
  const fillLight = new THREE.DirectionalLight(0x9966ff, 0.5);
  fillLight.position.set(50, 30, 50);
  scene.add(fillLight);

  return { sunLight };
}