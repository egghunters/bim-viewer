import * as THREE from "three";

/**
 * MaterialUtils class
 */
export default class MaterialUtils {
  /**
   * Compares two materials
   */
  public static materialEquals(m1: THREE.Material, m2: THREE.Material): boolean {
    if (m1 === m2) {
      return true;
    }
    if (m1 instanceof THREE.Material && m2 instanceof THREE.Material) {
      const result = m1.type === m2.type &&
        m1.alphaTest === m2.alphaTest &&
        m1.opacity === m2.opacity &&
        m1.side === m2.side &&
        m1.visible === m2.visible &&
        m1.name === m2.name &&
        m1.transparent === m2.transparent &&
        this.colorEquals((m1 as any).color, (m2 as any).color) &&
        this.colorEquals((m1 as any).emissive, (m2 as any).emissive) &&
        (m1 as any).roughness === (m2 as any).roughness &&
        (m1 as any).metalness === (m2 as any).metalness &&
        (m1 as any).alphaMap === (m2 as any).alphaMap;
      // there are more, but let's compare these for now!
      return result;
    }
    return false;
  }

  /**
   * Compares two materials, which could be material or material array
   */
  public static materialsEquals(m1: THREE.Material | THREE.Material[], m2: THREE.Material | THREE.Material[]): boolean {
    if (m1 === m2) {
      return true;
    } else if (Array.isArray(m1) && Array.isArray(m2) && m1.length === m2.length) {
      for (let i = 0; i < m1.length; ++i) {
        if (!this.materialEquals(m1[i], m2[i])) {
          return false;
        }
      }
      return true;
    } else if (m1 instanceof THREE.Material && m2 instanceof THREE.Material) {
      return this.materialEquals(m1, m2);
    }
    return false;
  }

  /**
   * Compares two colors
   */
  public static colorEquals(c1: THREE.Color, c2: THREE.Color): boolean {
    if (c1 === c2) {
      return true;
    }
    if (c1 instanceof THREE.Color && c2 instanceof THREE.Color) {
      return c1.equals(c2);
    }
    return false;
  }
}
