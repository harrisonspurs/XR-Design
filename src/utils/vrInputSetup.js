import * as THREE from "three";

export function setupVRInput(renderer, playerController) {
  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);

  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      // Handle VR input every frame
      if (frame && renderer.xr.isPresenting) {
        const session = frame.session;
        if (session && session.inputSources) {
          handleVRControllers(session, playerController, renderer);
        }
      }

      callback(time, frame);
    });
  };
}

function handleVRControllers(session, playerController, renderer) {
  const movement = playerController.movement;
  const camera = renderer.xr.getCamera();

  let moveX = 0;
  let moveY = 0;

  // Process each controller
  for (let i = 0; i < session.inputSources.length; i++) {
    const source = session.inputSources[i];
    if (!source.gamepad) continue;

    const axes = source.gamepad.axes;
    const buttons = source.gamepad.buttons;

    // Left controller (index 0)
    if (i === 0) {
      // Thumbstick: axes[2] = X (left/right), axes[3] = Y (up/down)
      moveX = axes[2] || 0;
      moveY = axes[3] || 0;

      // Apply deadzone
      if (Math.abs(moveX) < 0.2) moveX = 0;
      if (Math.abs(moveY) < 0.2) moveY = 0;

      // Map movement
      movement.forward = moveY > 0.1;
      movement.backward = moveY < -0.1;
      movement.left = moveX < -0.1;
      movement.right = moveX > 0.1;

      // Button 0 = A button (jump)
      if (buttons[0]?.pressed) {
        movement.jump = true;
      }

      // Trigger buttons for interaction (E key)
      if (buttons[4]?.pressed || buttons[5]?.pressed) {
        // Simulate E key press
        const event = new KeyboardEvent("keydown", {
          code: "KeyE",
          key: "e",
        });
        document.dispatchEvent(event);
      }
    }

    // Right controller (index 1) - turning
    if (i === 1) {
      const turnX = axes[2] || 0;

      if (Math.abs(turnX) > 0.2 && camera) {
        camera.rotation.y -= turnX * 0.05;
      }
    }
  }
}
