import * as THREE from "three";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier";

/**
 * SimplifyUtils class is used to simplify objects' geomery for a given object
 */
export default class SimplifyUtils {
  /**
   * Gets simplified object.
   */
  public static getSimplyfiedObject(object: THREE.Object3D, simplifyRate: number): THREE.Object3D {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line) || !object.geometry) {
      return object;
    }

    const modifier = new SimplifyModifier();
    const numberOfVerticesToRemove = this.getNumberOfVerticesToRemove(object.geometry, simplifyRate);
    if (numberOfVerticesToRemove > 0) {
      const clonedObj = object.clone(true);
      clonedObj.geometry = modifier.modify(clonedObj.geometry.clone(), numberOfVerticesToRemove); // don't need to dispose the cloned geometry?
      return clonedObj;
    }
    return object;
  }

  /**
   * Gets number of vertices to remove
   */
  private static getNumberOfVerticesToRemove(geometry: THREE.BufferGeometry, simplifyRate: number): number {
    let count = 0;
    if (geometry instanceof THREE.BufferGeometry) {
      if (geometry.index) {
        count = geometry.attributes.position.count;
      }
    }
    // if (count < 100) return 0 // don't simplify small objects
    const result = Math.floor(count * simplifyRate);
    if (count < 20) {
      return 0;
    }
    return result;
  }
}
