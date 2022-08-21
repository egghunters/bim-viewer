import * as THREE from "three";
import { SHPParser } from "./Shp";
import { ShpThree } from "./ShpThree";

/**
 * ArcGIS SHP file loader
 */
export class SHPLoader {
  public async load(url: string, onLoad: (object: THREE.Object3D) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void) {
    this.updateProgress(onProgress, 0);

    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      this.updateProgress(onProgress, 50); // we actually don't know an exact progress, while write one here
      // console.log(xhr.response)
      const parser = new SHPParser();
      const parsedShp = parser.parse(xhr.response);
      const model = new ShpThree().createModel(parsedShp);
      this.updateProgress(onProgress, 99);
      onLoad(model);
    };
    xhr.onerror = onerror;
    xhr.open("GET", url);
    xhr.send(null);
  }

  /**
   *
   * @param percent a number between [0, 100]
   */
  private updateProgress(onProgress: ((event: ProgressEvent) => void) | undefined, percent: number) {
    if (onProgress) {
      const progressEventInit = { lengthComputable: true, loaded: percent, total: 100 };
      onProgress(new ProgressEvent("progress", progressEventInit));
    }
  }
}
