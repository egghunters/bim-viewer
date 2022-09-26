import * as THREE from "three";
import SceneUtils from "./SceneUtils";

/**
 * Creates a sky box with light blue sky.
 * See code here:
 * https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_lightmap.html
 */
export default class SkyboxUtils {
  static NAME = "SKYBOX";
  static MIN_SKY_RADIUS = 4000;
  static MAX_SKY_RADIUS = 20000;
  static vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`;

  static fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 skylineColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    uniform vec3 skyCenter;
    varying vec3 vWorldPosition;
    void main() {
      vec3 position = vec3(vWorldPosition.x - skyCenter.x, vWorldPosition.y - skyCenter.y, vWorldPosition.z - skyCenter.z);
      float h = normalize( position + offset ).y;
      vec3 color;
      if (h > 0.0) {
        color = mix( skylineColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) );
      } else {
        color = mix( skylineColor, bottomColor, max( pow( max( -h, 0.0 ), exponent ), 0.0 ) );
      }
      gl_FragColor = vec4(color , 1.0 );
    }`;

  /**
   * Creates sky
   * @param radius
   * @param widthSegments
   * @param heightSegments
   */
  public static createSkyOfGradientRamp(radius: number = 4000, widthSegments: number = 32, heightSegments: number = 15, skyCenter = new THREE.Vector3()): THREE.Mesh {
    const uniforms = {
      topColor: { value: new THREE.Color(0x86B6F5) }, // 0xaabbff
      skylineColor: { value: new THREE.Color(0xffffff) },
      bottomColor: { value: new THREE.Color(0x999999) }, // 0x6A6A6A
      offset: { value: 400 },
      exponent: { value: 0.9 },
      skyCenter: { value: skyCenter || new THREE.Vector3() }
    };
    // note that the camera's far distance should bigger than the radius,
    // otherwise, you cannot see the sky
    const skyGeo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.matrixAutoUpdate = false; // for better performance
    sky.name = this.NAME;
    sky.userData.selectable = false;
    return sky;
  }

  /**
   * Creates sky according to objects in the scene. Need to do this because
   * objects' size and position may be large or out of sky box.
   */
  public static createSkyOfGradientRampByObjectsInScene(scene: THREE.Scene, objectUuids: string[]): THREE.Mesh {
    if (!scene) {
      return new THREE.Mesh();
    }
    const bbox = SceneUtils.getObjectsBoundingBox(scene, objectUuids);
    return SkyboxUtils.createSkyOfGradientRampByBoundingBox(bbox);
  }

  /**
   * Create sky according to a bounding box
   */
  public static createSkyOfGradientRampByBoundingBox(bbox: THREE.Box3) {
    const distance = (bbox.max.x - bbox.min.x) + (bbox.max.y - bbox.min.y) + (bbox.max.z - bbox.min.z);
    let radius = distance * 2; // make sky 10 times larger than objects' size

    // make sky radium in a reasonable range, it looks bad if too small, and won't be visible if too far.
    if (radius < SkyboxUtils.MIN_SKY_RADIUS) {
      radius = SkyboxUtils.MIN_SKY_RADIUS;
    } else if (radius > SkyboxUtils.MAX_SKY_RADIUS) {
      radius = SkyboxUtils.MAX_SKY_RADIUS;
    }
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    const sky = SkyboxUtils.createSkyOfGradientRamp(radius, undefined, undefined, center);
    // make sky's center, at the center of object (and set y to 0)
    sky.position.set(center.x, 0, center.z);
    return sky;
  }

  /**
   * Creates skybox by 6 pictures. The texture should be assigned to scene.background.
   * Currently, there is only a 'cloudy' texture.
   */
  public static async createSkyFromTextures(subFolder: "cloudy" = "cloudy"): Promise<THREE.CubeTexture> {
    const loader = new THREE.CubeTextureLoader();
    loader.setPath(`images/skybox/${subFolder}/`);
    // six pictures in order of: x, -x, y, -y, z, -z, aka, right, left, top, bottom, front, back
    const pictures = ["right.jpg", "left.jpg", "top.jpg", "bottom.jpg", "front.jpg", "back.jpg"];
    return new Promise<THREE.CubeTexture>((resolve, reject) => {
      loader.load(pictures, (t: THREE.CubeTexture) => resolve(t));
    });
  }
}
