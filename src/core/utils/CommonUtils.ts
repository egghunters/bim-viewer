import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

/**
 * CommonUtils
 **/
export default class CommonUtils {
  /**
   * Checks full screen mode
   */
  static checkFullScreen(): Boolean | undefined {
    const doc = document as any;
    const isFull = doc.mozCancelFullScreen ||
      (window as any).oRequestFullscreen ||
      doc.webkitIsFullScreen ||
      doc.msFullscreenEnabled;
    return isFull;
  }

  /**
   * Enters full screen mode
   */
  static fullScreen() {
    const ele = document.documentElement as any;
    const func =
      ele.requestFullscreen ||
      ele.mozRequestFullScreen ||
      ele.webkitRequestFullscreen ||
      ele.msRequestFullscreen;
    func.call(ele);
  }

  /**
   * Exits full screen mode
   */
  static exitFullscreen() {
    const doc = document as any;
    const func =
      doc.exitFullScreen ||
      doc.mozCancelFullScreen ||
      doc.webkitExitFullscreen ||
      doc.msExitFullscreen;
    func.call(doc);
  }

  /**
   * Displays a pointer marker in a period of time.
   * @param duration display time in ms. 0/null/undefined means always display.
   */
  static displayPointMarker(scene: THREE.Scene, position: THREE.Vector3, duration = 1000, radius = 10): CSS2DObject {
    const div = document.createElement("div");
    div.style.cssText = `display: block; width: ${radius}px; height: ${radius}px; border-radius: 50%; background: #505050; opacity: 0.2`;
    const marker = new CSS2DObject(div);
    marker.position.set(position.x, position.y, position.z);
    scene.add(marker);
    if (duration) {
      setTimeout(() => {
        scene.remove(marker);
      }, duration);
    }
    return marker;
  }
}
