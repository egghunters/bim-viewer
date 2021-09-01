import * as THREE from "three";
import Exploder from "../exploder/Exploder";

/**
 * Util methods about Scene
 */
export default class SceneUtils {
  /**
   * Get all visible objects' bounding box in a scene.
   * @param scene
   */
  static getVisibleObjectBoundingBox(scene: THREE.Scene): THREE.Box3 {
    const bbox = new THREE.Box3();
    scene.traverseVisible((object) => {
      if (object instanceof THREE.Mesh && object.userData.selectable !== false) {
        bbox.expandByObject(object);
      }
    });
    return bbox;
  }

  public static getObjectsBoundingBox(scene: THREE.Scene, objectUuids: string[]): THREE.Box3 {
    const bbox = new THREE.Box3();
    objectUuids.forEach(uuid => {
      const object = scene.getObjectByProperty("uuid", uuid);
      if (object) {
        const box = SceneUtils.getBoundingBox(object); // use getBoundingBox rather than expandByObject to work for InstancedMesh
        if (!box.isEmpty()) {
          bbox.union(box);
        }
      }
    });
    return bbox;
  }

  /**
   * Box3.expandByObject() doesn't work well in some case.
   * E.g. when object's position is far away from object's center?
   * When objects are instanced?
   * That's why we need a method to find bounding box by object's children!
   * And, better to do sampling in case there are too many children.
   */
  public static getBoundingBox(object: THREE.Object3D, sampling = true): THREE.Box3 {
    const bbox = new THREE.Box3();
    if (object instanceof THREE.InstancedMesh) {
      return SceneUtils.getInstancedMeshBoundingBox(object);
    }
    if (object.children.length === 0) {
      bbox.expandByObject(object); // for leaf object, call expandByObject directly
      return bbox;
    }
    // now, need to get geometry from children
    const count = object.children.length;
    let divisor = 1; // used for sampling
    if (count > 20) divisor = 3; // sampling 1/3
    if (count > 100) divisor = 5;
    if (count > 200) divisor = 10;
    if (count > 1000) divisor = 100; // sampling 1/100
    object.updateMatrixWorld(false);
    // const matrixWorld = object.matrixWorld
    for (let i = 0; i < count; ++i) {
      const child = object.children[i] as any;
      // if don't do sampling, expand by each children; Otherwise, only expand by some children
      if (!sampling || i % divisor === 0) {
        child.updateMatrix();
        if (child instanceof THREE.InstancedMesh) {
          const box = SceneUtils.getInstancedMeshBoundingBox(child);
          // box.applyMatrix4(matrixWorld) // need to consider parent's world matrix
          bbox.union(box);
        } else {
          bbox.expandByObject(child);
        }
      }
    }
    return bbox;
  }

  /**
   * InstancedMesh is different, we need to get its child meshes in order to get the bounding box
   */
  public static getInstancedMeshBoundingBox(mesh: THREE.InstancedMesh): THREE.Box3 {
    const bbox = new THREE.Box3();
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; ++i) {
      mesh.getMatrixAt(i, matrix);
      const geom = mesh.geometry.clone();
      if (geom.boundingBox) {
        const box = geom.boundingBox.applyMatrix4(matrix);
        if (!box.isEmpty() && !isNaN(box.min.x) && !isNaN(box.min.y) && !isNaN(box.min.z) && !isNaN(box.max.x) && !isNaN(box.max.y) && !isNaN(box.max.z)) {
          bbox.union(box);
        }
      }
    }
    bbox.applyMatrix4(mesh.matrixWorld); // need to apply matrixWorld
    return bbox;
  }

  private static explodeObject(object: THREE.Object3D, scene: THREE.Scene, exploderDict: { [objId: number]: Exploder }, onlyExplodeUp = false) {
    if (exploderDict[object.id]) {
      // if there is existing explode, probably it is exploded already. Need to unexplode it first.
      exploderDict[object.id].unexplode();
    }
    const position = new THREE.Vector3();
    SceneUtils.getPositionCenter(object, position);
    const exploder = new Exploder(scene, object.id, position);
    exploder.setOnlyExplodeUp(onlyExplodeUp);
    exploder.explode();
    exploderDict[object.id] = exploder;
  }

  static explodeObjects(scene: THREE.Scene, exploderDict: { [objId: number]: Exploder }, objectUuids: string[], onlyExplodeUp = false) {
    // const exploderDict: { [objId: number]: Exploder } = {}
    scene.traverse(object => {
      if (objectUuids.find(id => id === object.uuid)) {
        // convert uuid to id, and new Exploder for each object to be exploded
        if (object.children && object.children.length === 1) {
          // if there is only one child, explode its child
          SceneUtils.explodeObject(object.children[0], scene, exploderDict, onlyExplodeUp);
        } else {
          SceneUtils.explodeObject(object, scene, exploderDict, onlyExplodeUp);
        }
      }
    });
    return exploderDict;
  }

  static unexplodeObjects(scene: THREE.Scene, exploderDict: { [objId: number]: Exploder }) {
    scene.traverse(object => {
      const exploder = exploderDict[object.id];
      if (exploder) {
        exploder.unexplode();
        delete exploderDict[object.id];
      }
    });
  }

  public static getPositionCenter(object: THREE.Object3D, center: THREE.Vector3) {
    const bbox = SceneUtils.getBoundingBox(object);
    bbox.getCenter(center);
    center.y = bbox.min.y; // while, set the elevation value to the min, rather than the real center of y-axis
  }
}
