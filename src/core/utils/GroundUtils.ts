
import * as THREE from "three";

export default class GroundUtils {
  static GROUND_GRID_NAME = "GROUND_GRID";
  static GRASS_GROUND_NAME = "GRASS_GROUND";
  static DEFAULT_WIDTH = 1000;
  static DEFAULT_HEIGHT = 1000;
  static DEFAULT_WIDTH_SEGS = 100; // number of segments
  static DEFAULT_HEIGHT_SETS = 100;
  static DEFAULT_MAT_PARAMS = { color: 0xc3c3c3, transparent: true, opacity: 0.5, wireframeLinewidth: 0.5 };

  /**
   * Creates ground grid
   */
  static createGroundGrid(size?: number, divisions?: number, groundCenter?: THREE.Vector3): THREE.GridHelper {
    // see code from: https://threejs.org/examples/#webgl_geometry_spline_editor
    size = size || this.DEFAULT_WIDTH;
    divisions = divisions || this.DEFAULT_WIDTH_SEGS;

    const helper = new THREE.GridHelper(size, divisions);
    if (groundCenter) {
      helper.position.set(groundCenter.x, groundCenter.y, groundCenter.z);
    } else {
      helper.position.y = 0;
    }
    const mat = helper.material;
    if (!Array.isArray(mat)) {
      mat.opacity = this.DEFAULT_MAT_PARAMS.opacity;
      mat.transparent = this.DEFAULT_MAT_PARAMS.transparent;
    }
    helper.name = this.GROUND_GRID_NAME;
    helper.userData.selectable = false;
    helper.matrixAutoUpdate = false;
    helper.updateMatrix();
    return helper;
  }

  static async createGrassGround(texture?: string, width?: number, height?: number, repeatX?: number, repeatY?: number): Promise<THREE.Mesh> {
    width = width || this.DEFAULT_WIDTH;
    height = height || this.DEFAULT_HEIGHT;

    return new Promise((resolve) => {
      // see code from: https://threejs.org/examples/#webgl_animation_cloth
      const loader = new THREE.TextureLoader();
      loader.load(texture || "images/terrain/grass.jpg", (groundTexture) => {
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(repeatX || this.DEFAULT_WIDTH_SEGS / 5, repeatY || this.DEFAULT_HEIGHT_SETS / 5);
        groundTexture.anisotropy = 16;
        groundTexture.encoding = THREE.sRGBEncoding;

        const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture });
        groundMaterial.side = THREE.FrontSide;

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), groundMaterial);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0;
        mesh.receiveShadow = true;
        mesh.name = this.GRASS_GROUND_NAME;
        mesh.userData.selectable = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        return resolve(mesh);
      });
    });
  }
}
