import * as THREE from "three";
import { DRACOExporter, DRACOExporterOptions } from "three/examples/jsm/exporters/DRACOExporter";
import { GLTFExporter, GLTFExporterOptions } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";

export class ExportUtils {
  public static EXTENSION_GLTF = ".gltf";
  public static EXTENSION_GLB = ".glb";
  public static EXTENSION_OBJ = ".obj";
  public static EXTENSION_DRACO = ".drc";
  public static EXTENSION_JSON = ".json";

  // creates a link element in order to trigger download
  private static downloadLink: HTMLAnchorElement;

  /**
   * Exports given object to gltf file
   */
  public static exportToGltf(input: THREE.Object3D, filename: string) {
    ExportUtils.exportToGltfOrGlb(input, filename, { binary: false });
  }

  /**
   * Exports given object to glb file
   */
  public static exportToGlb(input: THREE.Object3D, filename: string) {
    ExportUtils.exportToGltfOrGlb(input, filename, { binary: true });
  }

  /**
   * Exports given object to gltf/glb file
   * @param input given object
   * @param filename filename without path, nor extension
   * @param options
   */
  public static exportToGltfOrGlb(input: THREE.Object3D, filename: string, options: GLTFExporterOptions = {}) {
    if (!input || !filename) {
      throw new Error("Invalid input or filename!");
    }
    // Something is wrong when upgrading threejs version, so disable this feature for now
    // console.warn("Not implemented yet!");
    const exporter = new GLTFExporter();
    const DEFAULT_OPTIONS: GLTFExporterOptions = {
      binary: true,
      onlyVisible: false,
      includeCustomExtensions: false
    };
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    exporter.parse(input, (gltf: object) => {
      if (options.binary) {
        filename = ExportUtils.addExtention(filename, ExportUtils.EXTENSION_GLB);
        const ab = gltf as ArrayBuffer;
        ExportUtils.saveArrayBuffer(ab, filename);
      } else {
        filename = ExportUtils.addExtention(filename, ExportUtils.EXTENSION_GLTF);
        ExportUtils.saveJson(gltf, filename);
      }
    }, (error: ErrorEvent) => console.log(error),
    options);
  }

  /**
   * Exports given object to obj file
   */
  public static exportToObj(input: THREE.Object3D, filename: string) {
    if (!input || !filename) {
      throw new Error("Invalid input or filename!");
    }
    filename = ExportUtils.addExtention(filename, ExportUtils.EXTENSION_OBJ);
    const exporter = new OBJExporter();
    const result = exporter.parse(input);
    ExportUtils.saveString(result, filename);
  }

  /**
   * Exports given object to draco(drc) file
   */
  public static exportToDraco(input: THREE.Mesh, filename: string, options: DRACOExporterOptions = {}) {
    if (!input || !filename) {
      throw new Error("Invalid input or filename!");
    }
    filename = ExportUtils.addExtention(filename, ExportUtils.EXTENSION_DRACO);
    const exporter = new DRACOExporter();
    const DEFAULT_OPTIONS: DRACOExporterOptions = {
      encodeSpeed: 5
    };
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const result = exporter.parse(input, options);
    ExportUtils.saveArrayBuffer(result, filename);
  }

  /**
   * Exports to threejs json
   * @param input
   * @param filename
   */
  public static exportToThreeJsJson(input: THREE.Object3D, filename: string) {
    const json = input.toJSON();
    if (!filename.toLowerCase().endsWith(ExportUtils.EXTENSION_JSON)) {
      filename += ExportUtils.EXTENSION_JSON;
    }
    ExportUtils.saveJson(json, filename);
  }

  /**
   * Saves blob as file
   */
  static save(blob: Blob, filename: string) {
    let link = ExportUtils.downloadLink;
    if (!link) {
      link = document.createElement("a");
      link.style.display = "none";
      document.body.appendChild(link);
      ExportUtils.downloadLink = link;
    }
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  static saveArrayBuffer(buffer: ArrayBuffer, filename: string) {
    ExportUtils.save(new Blob([buffer], { type: "application/octet-stream" }), filename);
  }

  static saveJson(json: Object, filename: string) {
    ExportUtils.saveJsonString(JSON.stringify(json), filename);
  }

  static saveJsonString(jsonString: string, filename: string) {
    ExportUtils.save(new Blob([jsonString], { type: "application/json" }), filename);
  }

  static saveString(str: string, filename: string) {
    ExportUtils.save(new Blob([str], { type: "text/csv" }), filename);
  }

  /**
   * Adds extention if missing
   */
  private static addExtention(filename: string, extension: string) {
    if (!filename.toLowerCase().endsWith(extension.toLowerCase())) {
      filename += extension;
    }
    return filename;
  }
}
