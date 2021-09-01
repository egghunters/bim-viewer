import { BasePlaneSection } from "./BasePlaneSection";
import { Box3, Scene, WebGLRenderer, PerspectiveCamera, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Objects' plane section
 **/
export class ObjectsPlaneSection extends BasePlaneSection {
  // basic member data
  private objectUuids: string[];

  /**
   * Constructor
   */
  constructor(objectUuids: string[], scene: Scene, camera: PerspectiveCamera | OrthographicCamera, renderer: WebGLRenderer, controls: OrbitControls) {
    super(scene, camera, renderer, controls);

    this.objectUuids = objectUuids;
    const box3 = new Box3();
    this.objectUuids.forEach(uuid => {
      const object = this.scene.getObjectByProperty("uuid", uuid);
      object && box3.expandByObject(object); // gets object's bounding box
    });
    box3.expandByScalar(1.5); // expand bounding box a bit
    super.setSectionPlane(box3);
  }

  /**
   * Initialize 6 section plane
   **/
  protected initSectionPlane() {
    super.initSectionPlane();
    this.objectUuids.forEach(uuid => {
      const object = this.scene.getObjectByProperty("uuid", uuid);
      object && object.traverse((child: any) => {
        if (["Mesh", "LineSegments"].includes(child.type)) {
          child.material.clippingPlanes = this.planes;
          // Reference: https://www.cnblogs.com/xiaxiangx/p/13873037.html
          child.material.clipIntersection = true;
        }
      });
    });
  }

  /**
   * Clears section plane
   **/
  protected clearSectionPlane() {
    super.clearSectionPlane();
    this.objectUuids.forEach(uuid => {
      const object = this.scene.getObjectByProperty("uuid", uuid);
      object && object.traverse((child: any) => {
        if (["Mesh", "LineSegments"].includes(child.type)) {
          child.material.clippingPlanes = [];
        }
      });
    });
  }
}
