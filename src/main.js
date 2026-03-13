import { createScene } from "./components/createScene.js";
import { createEnvironment } from "./components/createEnvironment.js";
import { createControls } from "./components/createControls.js";
import { createRooftop } from "./components/createRooftop.js";
import { createBoombox } from "./components/createBoombox.js";
import { createChair } from "./components/createChair.js";
import { createCityscape } from "./components/createCityscape.js";
import { createRecordBox } from "./components/createRecordBox.js";
import "./components/createPrompt.js";

async function init() {

  const { scene, camera, renderer } = createScene();
  await createEnvironment(scene, renderer);

  const { update: updateBoombox } = await createBoombox(scene, camera);
  const { update: updateChair, getIsSeated } = await createChair(scene, camera);
  const { update: updateRecordBox } = await createRecordBox(scene, camera);

  await createRooftop(scene);
  createCityscape(scene);

  const { update: updateControls } = createControls(camera, renderer, getIsSeated);

  renderer.setAnimationLoop(() => {
    updateControls();
    updateBoombox();
    updateChair();
    updateRecordBox();
    renderer.render(scene, camera);
  });

}

init().catch(console.error);