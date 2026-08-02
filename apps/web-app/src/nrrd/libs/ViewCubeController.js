import { Vector3 } from "three";
import TWEEN from "@tweenjs/tween.js"; 

export const TOP = {
  offsetFactor: {
    x: 0,
    y: 1,
    z: 0,
  },
};

export const BOTTOM = {
  offsetFactor: {
    x: 0,
    y: -1,
    z: 0,
  },
};

export const FRONT = {
  offsetFactor: {
    x: 0,
    y: 0,
    z: 1,
  },
};

export const BACK = {
  offsetFactor: {
    x: 0,
    y: 0,
    z: -1,
  },
};

export const LEFT = {
  offsetFactor: {
    x: -1,
    y: 0,
    z: 0,
  },
};

export const RIGHT = {
  offsetFactor: {
    x: 1,
    y: 0,
    z: 0,
  },
};

class ViewCubeController { 
  static CubeOrientation = {
    Top: "S",
    Bottom: "I",
    Front: "R",
    Back: "L",
    Left: "P",
    Right: "A",
  };

  static ORIENTATIONS = {
    [ViewCubeController.CubeOrientation.Top]: TOP,
    [ViewCubeController.CubeOrientation.Bottom]: BOTTOM,
    [ViewCubeController.CubeOrientation.Front]: FRONT,
    [ViewCubeController.CubeOrientation.Back]: BACK,
    [ViewCubeController.CubeOrientation.Left]: LEFT,
    [ViewCubeController.CubeOrientation.Right]: RIGHT,
  };

   

  constructor(camera ) {
    this.camera = camera;
  }

  tweenCamera(orientation) {
    const { offsetFactor } = orientation;

    if (this.camera) {
      const offsetUnit = this.camera.position.length();
      const offset = new Vector3(
        offsetUnit * offsetFactor.x,
        offsetUnit * offsetFactor.y,
        offsetUnit * offsetFactor.z
      );

      const center = new Vector3();
      const finishPosition = center.add(offset);

      // The target position the camera should always look at
      const targetPosition = new Vector3(0, 0, 0);

      const positionTween = new TWEEN.Tween(this.camera.position)
        .to(finishPosition, 300)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onUpdate(() => {
          // Update the camera rotation to look at the target position
          this.camera.lookAt(targetPosition);
        });

      positionTween.start();
    }
  }

  tweenCallback() {
    TWEEN.update();
  }
}

export default ViewCubeController;
