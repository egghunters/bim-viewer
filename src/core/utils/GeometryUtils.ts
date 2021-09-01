import * as THREE from "three";

/**
 * GeometryUtils class
 */
export default class GeometryUtils {
  /**
   * Compares two materials
   */
  public static geometryEquals(g1: THREE.BufferGeometry, g2: THREE.BufferGeometry): boolean {
    if (g1 === g2) {
      return true;
    }
    const result =
      g1.type === g2.type &&
      g1.name === g2.name &&
      g1.morphTargetsRelative === g2.morphTargetsRelative &&
      this.equals<THREE.Box3>(g1.boundingBox, g2.boundingBox) &&
      this.equals<THREE.Sphere>(g1.boundingSphere, g2.boundingSphere) &&
      this.attributesEqual(g1.attributes, g2.attributes) &&
      this.bufferAttributeEqual(g1.index, g2.index);
    // there are more, but let's compare these for now!
    return result;
  }

  /**
   * Checks if two types equal each other.
   * This method requires type T defined 'equals' method.
   */
  private static equals<T>(t1: T | null, t2: T | null): boolean {
    if (t1 === t2) {
      return true;
    } else if (!t1 && !t2) {
      return true;
    } else if (t1 && t2) {
      return (t1 as any).equals(t2);
    } else {
      // in case, one of b1 or b2 is null or undefined
      return false;
    }
  }

  private static attributesEqual(a1: any, a2: any): boolean {
    if (a1 === a2) {
      return true;
    }
    const keys1 = Object.keys(a1).sort();
    const keys2 = Object.keys(a2).sort();
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (let i = 0; i < keys1.length; ++i) {
      if (keys1[i] !== keys2[i]) {
        return false;
      }
      const ba1 = a1[keys1[i]] as THREE.BufferAttribute;
      const ba2 = a2[keys2[i]] as THREE.BufferAttribute;
      const equals = this.bufferAttributeEqual(ba1, ba2);
      if (!equals) {
        return false;
      }
    }
    return true;
  }

  private static bufferAttributeEqual(b1: THREE.BufferAttribute | null, b2: THREE.BufferAttribute | null): boolean {
    if (b1 === b2) {
      return true;
    } if (!b1 || !b2) {
      return false;
    }
    const equals = b1.name === b2.name &&
      b1.itemSize === b2.itemSize &&
      b1.count === b2.count &&
      b1.normalized === b2.normalized;
    if (!equals) {
      return false;
    }

    // compare 'array' if there is
    if (b1.array && b2.array) {
      if (b1.array.length !== b2.array.length) {
        return false;
      }
      for (let i = 0; i < b1.array.length; ++i) {
        if (b1.array[i] !== b2.array[i]) {
          return false;
        }
      }
    } else if (b1.array || b2.array) {
      return false;
    }

    // compare 'data' if there is
    const d1 = (b1 as any).data;
    const d2 = (b2 as any).data;
    if (d1 && d2) {
      if (d1.length !== d2.length) {
        return false;
      }
      for (let i = 0; i < d1.length; ++i) {
        if (d1[i] !== d2[i]) {
          return false;
        }
      }
    } else if (d1 || d2) {
      return false;
    }
    return true;
  }

  /**
   * Converts InterleavedBufferAttribute to BufferAttribute, because mergeBufferGeometries doesn't support InterleavedBufferAttribute.
   * If it is supported by Three.js one day, we should remove this method.
   */
  public static tryConvertInterleavedBufferAttributes(geometry: THREE.BufferGeometry) {
    if (!geometry || !geometry.attributes) {
      return;
    }
    Object.keys(geometry.attributes).forEach(key => {
      const val = geometry.attributes[key];
      if (val instanceof THREE.InterleavedBufferAttribute) {
        const bufferAttr = val.clone(); // returns THREE.BufferAttribute
        geometry.attributes[key] = bufferAttr;
      }
    });
  }
}
