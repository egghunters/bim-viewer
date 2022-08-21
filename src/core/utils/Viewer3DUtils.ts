import * as THREE from "three";
import SceneUtils from "./SceneUtils";

export enum Views {
  Top = "Top",
  Bottom = "Bottom",
  Front = "Front",
  Back = "Back",
  Left = "Left",
  Right = "Right"
}

/**
 * Util methods about Viewer3D
 */
export default class Viewer3DUtils {
  /**
   * Calculates camera position and look at point by given scene
   * @param scene
   * @param view
   * @param eye this method pass out it to caller
   * @param look this method pass out it to caller
   */
  static getCameraPositionByView(scene: THREE.Scene, view: Views | string, eye: THREE.Vector3, look: THREE.Vector3) {
    const bbox = SceneUtils.getVisibleObjectBoundingBox(scene);
    Viewer3DUtils.getCameraPositionByBboxAndView(bbox, view, eye, look);
  }

  /**
   * Calculates camera position and look at point by given object uuids
   * @param scene
   * @param objectUuids
   * @param view
   * @param eye
   * @param look
   */
  public static getCameraPositionByObjectUuids(scene: THREE.Scene, objectUuids: string[], view: Views | string, eye: THREE.Vector3, look: THREE.Vector3) {
    const bbox = SceneUtils.getObjectsBoundingBox(scene, objectUuids);
    Viewer3DUtils.getCameraPositionByBboxAndView(bbox, view, eye, look);
  }

  /**
   * Gets camera's new position and target(lookAt) by given bbox and camera's current position
   */
  public static getCameraPositionByObjects(objects: THREE.Object3D[], camera: THREE.Camera, eye: THREE.Vector3, look: THREE.Vector3) {
    const bbox = new THREE.Box3();
    objects.forEach(object => {
      const box = SceneUtils.getBoundingBox(object);
      bbox.union(box);
    });
    Viewer3DUtils.getCameraPositionByBboxAndCamera(bbox, camera, eye, look);
  }

  /**
   * Gets camera's new position and target(lookAt) by given bbox and camera's current position
   */
  public static getCameraPositionByBboxAndCamera(bbox: THREE.Box3, camera: THREE.Camera, eye: THREE.Vector3, look: THREE.Vector3) {
    if (bbox.isEmpty()) {
      return;
    }
    // the distance between target object and camera depends on the size of object,
    // simply use object's summation of x, y, z size,
    // then multiply a factor, it looks better
    const DISTANCE_FACTOR = 1.2;
    let distance = (bbox.max.x - bbox.min.x) + (bbox.max.y - bbox.min.y) + (bbox.max.z - bbox.min.z);
    distance *= DISTANCE_FACTOR;
    // make camera a little farer, it looks better
    const distanceVector = new THREE.Vector3(distance, distance, distance);
    const cx = (bbox.min.x + bbox.max.x) / 2; // bbox's center x
    const cy = (bbox.min.y + bbox.max.y) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;
    look.set(cx, cy, cz);

    const oldPostion = new THREE.Vector3();
    camera.getWorldPosition(oldPostion);
    const dir = oldPostion.sub(look).normalize();
    // change camera's direction to look at new target first, then move camera to a proper distance with target
    const pos = dir.multiply(distanceVector).add(look);
    eye.set(pos.x, pos.y, pos.z);
  }

  /**
   * Gets camera's new position and target(lookAt) by given bbox and view
   */
  public static getCameraPositionByBboxAndView(bbox: THREE.Box3, view: Views | string, eye: THREE.Vector3, look: THREE.Vector3) {
    if (bbox.isEmpty()) {
      return;
    }
    // make camera a little farer, it looks better
    const distance = (bbox.max.x - bbox.min.x) + (bbox.max.y - bbox.min.y) + (bbox.max.z - bbox.min.z);
    // Make delta a number between 0.5 and 1. And delta is smaller as distance grows.
    const delta = (0.5 + (0.5 / Math.pow(Math.E, distance / 100))) * distance;
    let x = 0; // bbox.min.x + (bbox.max.x - bbox.min.x) // center by default
    let y = bbox.min.y + (bbox.max.y - bbox.min.y); // for front/back/left/right, give y a certain value, thus looks better
    let z = 0; // bbox.min.z + (bbox.max.z - bbox.min.z)
    const cx = (bbox.min.x + bbox.max.x) / 2; // bbox's center x
    const cy = (bbox.min.y + bbox.max.y) / 2;
    const cz = (bbox.min.z + bbox.max.z) / 2;
    if (view === Views.Top) {
      y = bbox.max.y + delta;
    } else if (view === Views.Bottom) {
      y = bbox.min.y - delta;
    } else if (view === Views.Front) {
      z = bbox.max.z + delta;
      x = cx;
    } else if (view === Views.Back) {
      z = bbox.min.z - delta;
      x = cx;
    } else if (view === Views.Left) {
      x = bbox.min.x - delta;
      z = cz;
    } else if (view === Views.Right) {
      x = bbox.max.x + delta;
      z = cz;
    }
    eye.x = x;
    eye.y = y;
    eye.z = z;
    look.x = cx;
    look.y = cy;
    look.z = cz;
  }

  /**
   * Sleep a while
   */
  public static async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("");
      }, ms);
    });
  }

  // need to store the objects that is twinkling, do this to avoid one object to be
  // twinkled while it is twinkling, that can be buggy!
  private static twinklingObjectUuids: { [uuid: string]: boolean } = {};

  /**
   * Twinkle the object several times
   */
  public static async twinkle(obj: THREE.Object3D, ms: number = 500) {
    const uuids = Viewer3DUtils.twinklingObjectUuids;
    if (uuids[obj.uuid]) {
      return; // avoid re-entry
    }
    uuids[obj.uuid] = true;

    obj.visible = !obj.visible;
    await this.sleep(ms);
    obj.visible = !obj.visible;
    await this.sleep(ms);
    obj.visible = !obj.visible;
    await this.sleep(ms);
    obj.visible = !obj.visible;
    await this.sleep(ms);
    obj.visible = !obj.visible;
    await this.sleep(ms);
    obj.visible = !obj.visible;

    delete uuids[obj.uuid]; // clear the flag
  }
}
