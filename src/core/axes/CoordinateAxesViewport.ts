import * as THREE from "three";
import CoordinateAxes from "./CoordinateAxes";
import Viewer3D from "@/core/Viewer3D";

/**
 * This renderer monitors the host renderer's camera, and keeps a coordinate axes
 * the same direction as host renderer's
 */
export default class CoordinateAxesViewport {
  hostRenderer?: Viewer3D;
  coordinateAxes?: CoordinateAxes;
  camera?: THREE.OrthographicCamera;
  scene?: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  height = 100; // size of render area
  width = 100;

  constructor(width?: number, height?: number) {
    this.width = width || this.width;
    this.height = height || this.height;
    this.init();
  }

  init() {
    this.initRenderer();
    this.initScene();
    this.animate();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
  }

  initScene() {
    this.scene = new THREE.Scene();
    // do not set a background color, thus background is gonna be transparent
    // this.scene.background = new THREE.Color(0xebf2f7)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.scene.add(this.camera);

    this.coordinateAxes = new CoordinateAxes();
    this.scene.add(this.coordinateAxes);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.render();
  }

  setHostRenderer(renderer: Viewer3D) {
    this.hostRenderer = renderer;
    this.update();
  }

  update() {
    if (!this.hostRenderer || !this.hostRenderer.camera) {
      return;
    }
    const camera = this.hostRenderer.camera;
    if (camera) {
      const target = new THREE.Vector3();
      camera.getWorldDirection(target);
      const up = camera.up;
      this.updateCameraDirection(target, up);
    }
  }

  /**
   * Update axes according to camera direction.
   * Camera's direction is the only input factor for this class. It always look at the origin.
   * @param direction
   */
  updateCameraDirection(direction: THREE.Vector3, up: THREE.Vector3) {
    if (!this.camera || !direction) {
      return;
    }
    direction.normalize();
    const distanceFactor = 2; // keep camera a little farer, so it looks better
    const centerDelta = 0.3; // put the lookAt point to be in the first quadrant
    this.camera.position.set(-direction.x * distanceFactor + centerDelta, -direction.y * distanceFactor + centerDelta, -direction.z * distanceFactor + centerDelta);
    this.camera.lookAt(centerDelta, centerDelta, centerDelta); // it always looks at the origin
    this.camera.up = up;
  }

  dispose() {
    if (!this.scene || !this.camera || !this.coordinateAxes) {
      return;
    }
    this.scene.clear(); // remove all child objects
    this.hostRenderer = undefined;
    this.camera = undefined;
    this.coordinateAxes = undefined;
    this.scene = undefined; // this is necessary to call
  }
}
