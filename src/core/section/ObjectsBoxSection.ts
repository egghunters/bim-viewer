import { BaseBoxSection } from "./BaseBoxSection";
import { Box3, Scene, WebGLRenderer, PerspectiveCamera, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Object's box section
 **/
export class ObjectsBoxSection extends BaseBoxSection {
  // basic member data
  private objectUuids: string[];

  /**
   * Constructor
   */
  constructor(objectsUuids: string[], scene: Scene, camera: PerspectiveCamera | OrthographicCamera, renderer: WebGLRenderer, controls: OrbitControls) {
    super(scene, camera, renderer, controls);

    this.objectUuids = objectsUuids;
    const box3 = new Box3();
    this.objectUuids.forEach(uuid => {
      const object = this.scene.getObjectByProperty("uuid", uuid);
      object && box3.expandByObject(object); // gets object's bounding box
    });
    box3.expandByScalar(1.5); // expand bounding box a bit
    super.setSectionBox(box3);
  }

  /**
   * Initialize 6 section plane
   **/
  protected initPlanes() {
    super.initPlanes();
    this.objectUuids.forEach(uuid => {
      const object = this.scene.getObjectByProperty("uuid", uuid);
      object && object.traverse((child: any) => {
        if (["Mesh", "LineSegments"].includes(child.type)) {
          child.material.clippingPlanes = this.planes;
          // clipIntersection is false by default, but it may changed by other section (ObjectsPlaneClipper, etc.)
          // so, need to set it back here
          child.material.clipIntersection = false;
        }
      });
    });
  }

  /**
   * Clears section box
   **/
  protected clearSectionBox() {
    super.clearSectionBox();
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
