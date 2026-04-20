export function setupVRInput(renderer, playerMovement) {
  // Update controller input each frame
  const originalSetAnimationLoop = renderer.setAnimationLoop.bind(renderer);
  renderer.setAnimationLoop = function (callback) {
    return originalSetAnimationLoop((time, frame) => {
      // Only process VR input if in XR mode
      if (frame && renderer.xr.isPresenting) {
        const session = frame.session;
        const inputs = session.inputSources;

        // Read left controller thumbstick (for movement)
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          if (input.gamepad && i === 0) {
            // Left thumbstick axes
            const x = input.gamepad.axes[2] || 0;
            const y = input.gamepad.axes[3] || 0;

            const deadzone = 0.2;
            const stickX = Math.abs(x) > deadzone ? x : 0;
            const stickY = Math.abs(y) > deadzone ? y : 0;

            // Map to movement
            playerMovement.forward = stickY > 0.1;
            playerMovement.backward = stickY < -0.1;
            playerMovement.left = stickX < -0.1;
            playerMovement.right = stickX > 0.1;
          }
        }
      }

      callback(time, frame);
    });
  };
}
