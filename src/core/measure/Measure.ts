import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { getUnitStr, getLengthValueByUnit } from "@/core/utils/UnitConversionUtils";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Settings as SettingsType, unitRange } from "@/components/projectSettingsPanel/ProjectSettingsDef";
import { showPrecisionValue } from "@/core/utils/DecimalPrecisionUtils";

export enum MeasureMode {
  Distance = "Distance",
  Area = "Area",
  Angle = "Angle"
}

/**
 * Measure class
 */
export default class Measure {
  // lineWidth is ignored for Chrome on Windows, which is a known issue:
  // https://github.com/mrdoob/three.js/issues/269
  static LINE_MATERIAL = new THREE.LineBasicMaterial({ color: 0xfff000, linewidth: 2, opacity: 0.8, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  static MESH_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x87cefa, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  static MAX_DISTANCE = 500; // when intersected object's distance is too far away, then ignore it
  static OBJ_NAME = "object_for_measure";
  static LABEL_NAME = "label_for_measure";

  public isCompleted = false; // whether measure operation is completed or not
  protected mode: MeasureMode;
  protected renderer: THREE.WebGLRenderer;
  protected scene: THREE.Scene;
  protected camera: THREE.Camera;
  protected controls: OrbitControls;
  protected spriteMaterial?: THREE.SpriteMaterial;
  protected raycaster?: THREE.Raycaster;
  protected mouseMoved = false;
  protected pointMarkers: THREE.Sprite[] = []; // used for measure distance and area
  protected polyline?: THREE.Line; // the line user draws while measuring distance
  protected faces?: THREE.Mesh; // the faces user draws while measuring area
  protected curve?: THREE.Line; // the arc curve to indicate the angle in degree
  protected tempPointMarker?: THREE.Sprite; // used to store temporary Points
  protected tempLine?: THREE.Line; // used to store temporary line, which is useful for drawing line/area/angle as mouse moves
  protected tempLabel?: CSS2DObject; // used to store temporary label as mouse moves
  protected labels: CSS2DObject[] = []; // stores labels, so that we can clear them up when necessary
  protected pointArray: THREE.Vector3[] = [];
  protected lastClickTime?: number; // save the last click time, in order to detect double click event
  protected settings: SettingsType;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, controls: OrbitControls, mode: MeasureMode = MeasureMode.Distance, settings: SettingsType) {
    this.mode = mode;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.settings = settings;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement as HTMLCanvasElement;
  }

  /**
   * Starts the measurement
   */
  open() {
    // add mouse 'click' event, but do not trigger highlight for mouse drag event
    // mouseup/mousedown/mousemove event is prevented by OrbitControls, let's use pointerup/pointerdown/pointermove
    this.canvas.addEventListener("pointerdown", this.mousedown);
    this.canvas.addEventListener("pointermove", this.mousemove);
    this.canvas.addEventListener("pointerup", this.mouseup);
    this.canvas.addEventListener("dblclick", this.dblclick);
    window.addEventListener("keydown", this.keydown);

    this.pointArray = [];
    this.raycaster = new THREE.Raycaster();

    // polyline is required for measuring distance, area and angle
    this.polyline = this.createLine();
    this.scene.add(this.polyline);
    if (this.mode === MeasureMode.Area) {
      this.faces = this.createFaces();
      this.scene.add(this.faces);
    }
    this.isCompleted = false;
    this.renderer.domElement.style.cursor = "crosshair";
  }

  /**
   * Ends the measurement
   */
  close() {
    this.canvas.removeEventListener("pointerdown", this.mousedown);
    this.canvas.removeEventListener("pointermove", this.mousemove);
    this.canvas.removeEventListener("pointerup", this.mouseup);
    this.canvas.removeEventListener("dblclick", this.dblclick);
    window.removeEventListener("keydown", this.keydown);

    this.tempPointMarker && this.scene.remove(this.tempPointMarker);
    this.tempLine && this.scene.remove(this.tempLine);
    this.tempLabel && this.scene.remove(this.tempLabel);
    this.pointMarkers.forEach(item => this.scene.remove(item));
    this.polyline && this.scene.remove(this.polyline);
    this.faces && this.scene.remove(this.faces);
    this.curve && this.scene.remove(this.curve);
    this.labels.forEach(item => this.scene.remove(item));
    this.pointArray = [];
    this.raycaster = undefined;
    this.tempPointMarker = undefined;
    this.tempLine = undefined;
    this.tempLabel = undefined;
    this.pointMarkers = [];
    this.polyline = undefined;
    this.labels = [];
    this.renderer.domElement.style.cursor = "";
  }

  /**
   * Initializes point marker material
   */
  initPointMarkerMaterial() {
    const markerTexture = new THREE.TextureLoader().load("images/circle.png");
    this.spriteMaterial = new THREE.SpriteMaterial({
      map: markerTexture,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      opacity: 0.8
    });
  }

  /**
   * Creates point marker
   */
  private createPointMarker(position?: THREE.Vector3): THREE.Sprite {
    if (!this.spriteMaterial) {
      this.initPointMarkerMaterial();
    }
    const p = position;
    const scale = 0.012; // change marker's size here
    const obj = new THREE.Sprite(this.spriteMaterial);
    obj.scale.set(scale, scale, scale);
    if (p) {
      obj.position.set(p.x, p.y, p.z);
    }
    obj.name = Measure.OBJ_NAME;
    return obj;
  }

  /**
   * Creates THREE.Line
   */
  private createLine(material = Measure.LINE_MATERIAL): THREE.Line {
    const geom = new THREE.BufferGeometry();
    const obj = new THREE.Line(geom, material);
    obj.frustumCulled = false; // Force to draw it. This fixes a bug that it disappear in some case
    obj.name = Measure.OBJ_NAME;
    return obj;
  }

  /**
   * Creates THREE.Mesh
   */
  private createFaces() {
    const geom = new THREE.BufferGeometry();
    const obj = new THREE.Mesh(geom, Measure.MESH_MATERIAL);
    // since we have to use BufferGeometry rather than Geometry, and we need to store points,
    // let's store points into userData!
    obj.userData.vertices = [];
    obj.frustumCulled = false; // Force to draw it. This fixes a bug that it disappear in some case
    obj.name = Measure.OBJ_NAME;
    return obj;
  }

  /**
   * Draw completed
   */
  complete() {
    if (this.isCompleted) {
      return; // avoid re-entry
    }
    let clearPoints = false;
    let clearPolyline = false;
    // for measure area, we need to make a close surface, then add area label
    const count = this.pointArray.length;
    if (this.mode === MeasureMode.Area && this.polyline) {
      if (count > 2) {
        const p0 = this.pointArray[0];
        this.polyline.geometry.setFromPoints([...this.pointArray, p0]); // close the line as a loop
        const area = this.calculateArea(this.pointArray);
        const label = `${showPrecisionValue(getLengthValueByUnit(area, unitRange["Unit from file"], this.settings.unit, 2).value, this.settings.decimalPrecision)} ${this.getUnitString()}`;
        const p = this.getBarycenter(this.pointArray);
        const labelObj = this.createLabel(label);
        labelObj.position.set(p.x, p.y, p.z);
        labelObj.element.innerHTML = label;
        this.scene.add(labelObj);
        this.labels.push(labelObj);
      } else {
        clearPoints = true;
        clearPolyline = true;
      }
    }
    if (this.mode === MeasureMode.Distance) {
      if (count < 2) {
        clearPoints = true;
      }
    }
    if (this.mode === MeasureMode.Angle && this.polyline) {
      if (count >= 3) {
        const p0 = this.pointArray[0];
        const p1 = this.pointArray[1];
        const p2 = this.pointArray[2];
        const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize();
        const dir1 = this.getAngleBisector(p0, p1, p2);
        const dir2 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
        const angle = this.calculateAngle(p0, p1, p2);
        const label = `${showPrecisionValue(angle, this.settings.decimalPrecision)} ${this.getUnitString()}`;
        const distance = Math.min(p0.distanceTo(p1), p2.distanceTo(p1));
        let d = distance * 0.3; // distance from label to p1
        let p = p1.clone().add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d)); // label's position
        const labelObj = this.createLabel(label);
        labelObj.position.set(p.x, p.y, p.z);
        labelObj.element.innerHTML = label;
        this.scene.add(labelObj);
        this.labels.push(labelObj);

        d = distance * 0.2; // distance from arc to p1
        p = p1.clone().add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d)); // arc's middle position
        const arcP0 = p1.clone().add(new THREE.Vector3(dir0.x * d, dir0.y * d, dir0.z * d));
        const arcP2 = p1.clone().add(new THREE.Vector3(dir2.x * d, dir2.y * d, dir2.z * d));
        this.curve = this.createCurve(arcP0, p, arcP2);
        this.scene.add(this.curve);
      } else {
        clearPoints = true;
        clearPolyline = true;
      }
    }
    // invalid case, clear useless objects
    if (clearPoints) {
      this.pointMarkers.forEach(item => this.scene.remove(item));
      this.pointMarkers = [];
    }
    if (clearPolyline && this.polyline) {
      this.scene.remove(this.polyline);
      this.polyline = undefined;
    }
    this.isCompleted = true;
    this.renderer.domElement.style.cursor = "";
    this.tempPointMarker && this.scene.remove(this.tempPointMarker);
    this.tempLine && this.scene.remove(this.tempLine);
    this.tempLabel && this.scene.remove(this.tempLabel);
  }

  /**
   * Draw canceled
   */
  cancel() {
    this.close();
  }

  mousedown = (e: MouseEvent) => {
    this.mouseMoved = false;
  };

  mousemove = (e: MouseEvent) => {
    this.mouseMoved = true;

    const point = this.getClosestIntersection(e);
    if (!point) {
      return;
    }

    // draw the temp point as mouse moves
    if (this.tempPointMarker) {
      this.tempPointMarker.position.set(point.x, point.y, point.z);
    } else {
      this.tempPointMarker = this.createPointMarker(point);
      this.scene.add(this.tempPointMarker);
    }

    // draw the temp line as mouse moves
    if (this.pointArray.length > 0) {
      const p0 = this.pointArray[this.pointArray.length - 1]; // get last point
      const line = this.tempLine || this.createLine();
      // line.computeLineDistances() // LineDashedMaterial requires to call this
      const geom = line.geometry;
      const startPoint = this.pointArray[0];
      const lastPoint = this.pointArray[this.pointArray.length - 1];
      if (this.mode === MeasureMode.Area) {
        // draw two line segments for area
        geom.setFromPoints([lastPoint, point, startPoint]); // close the line as a loop
      } else {
        geom.setFromPoints([lastPoint, point]);
      }
      if (this.mode === MeasureMode.Distance) {
        const dist = p0.distanceTo(point);
        const label = `${showPrecisionValue(getLengthValueByUnit(dist, unitRange["Unit from file"], this.settings.unit).value, this.settings.decimalPrecision)} ${this.getUnitString()}`; // hard code unit to 'm' here
        const position = new THREE.Vector3((point.x + p0.x) / 2, (point.y + p0.y) / 2, (point.z + p0.z) / 2);
        this.addOrUpdateTempLabel(label, position);
      }
      if (!this.tempLine) {
        this.scene.add(line); // just add to scene once
        this.tempLine = line;
      }
    }
  };

  mouseup = (e: MouseEvent) => {
    // if mouseMoved is ture, then it is probably moving, instead of clicking
    if (!this.mouseMoved) {
      this.onMouseClicked(e);
    }
  };

  dblclick = (e: MouseEvent) => {
    // double click means to complete the draw operation
    this.complete();
  };

  onMouseClicked = (e: MouseEvent) => {
    if (!this.raycaster || !this.camera || !this.scene || this.isCompleted) {
      return;
    }

    const point = this.getClosestIntersection(e);
    if (!point) {
      return;
    }

    // double click triggers two click events, we need to avoid the second click here
    const now = Date.now();
    if (this.lastClickTime && (now - this.lastClickTime < 500)) {
      return;
    }
    this.lastClickTime = now;

    this.pointArray.push(point);
    const count = this.pointArray.length;
    const marker = this.createPointMarker(point);
    this.pointMarkers.push(marker);
    this.scene.add(marker);
    if (this.polyline) {
      this.polyline.geometry.setFromPoints(this.pointArray);
      if (this.tempLabel && count > 1) {
        const p0 = this.pointArray[count - 2];
        this.tempLabel.position.set((p0.x + point.x) / 2, (p0.y + point.y) / 2, (p0.z + point.z) / 2);
        this.scene.add(this.tempLabel);
        this.labels.push(this.tempLabel);
        this.tempLabel = undefined;
      }
      // this.polyline.computeLineDistances() // LineDashedMaterial requires to call this
    }
    if (this.mode === MeasureMode.Area && this.faces) {
      const geom = this.faces.geometry as THREE.BufferGeometry;
      const vertices = this.faces.userData.vertices;
      vertices.push(point);
      geom.setFromPoints(vertices);
      const len = vertices.length;
      if (len > 2) {
        const indexArray = [];
        for (let i = 1; i < len - 1; ++i) {
          indexArray.push(0, i, i + 1); // add one triangle
        }
        geom.setIndex(indexArray);
        geom.computeVertexNormals();
      }
    }
    if (this.mode === MeasureMode.Angle && this.pointArray.length >= 3) {
      this.complete();
    }
  };

  keydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this.complete();
    } else if (e.key === "Escape") {
      this.cancel();
    }
  };

  /**
   * The the closest intersection
   * @param e
   */
  getClosestIntersection = (e: MouseEvent) => {
    if (!this.raycaster || !this.camera || !this.scene || this.isCompleted) {
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const mouse = new THREE.Vector2();
    mouse.x = (x / this.renderer.domElement.clientWidth) * 2 - 1; // must use clientWidth rather than width here!
    mouse.y = -(y / this.renderer.domElement.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(mouse, this.camera);
    let intersects = this.raycaster.intersectObject(this.scene, true) || [];
    if (intersects && intersects.length > 0) {
      // filter out the objects for measurement
      intersects = intersects.filter(item => {
        return item.object.name !== Measure.OBJ_NAME && item.object.visible;
      });
      if (intersects.length > 0 && intersects[0].distance < Measure.MAX_DISTANCE) {
        return intersects[0].point;
      }
    }
    return null;
  };

  /**
   * Adds or update temp label and position
   */
  addOrUpdateTempLabel(label: string, position: THREE.Vector3) {
    if (!this.tempLabel) {
      this.tempLabel = this.createLabel(label);
      this.scene.add(this.tempLabel);
    }
    this.tempLabel.position.set(position.x, position.y, position.z);
    this.tempLabel.element.innerHTML = label;
  }

  /**
   * Creates label
   */
  createLabel(text: string): CSS2DObject {
    const div = document.createElement("div");
    // div.className = 'annotationLabel'
    div.innerHTML = text;
    div.style.padding = "3px 6px";
    div.style.color = "#fff";
    div.style.fontSize = "12px";
    div.style.position = "absolute";
    div.style.backgroundColor = "rgba(25, 25, 25, 0.3)";
    div.style.borderRadius = "12px";
    // div.style.width = '200px'
    // div.style.height = '100px'
    div.style.top = "0px";
    div.style.left = "0px";
    // div.style.pointerEvents = 'none' // avoid html element to affect mouse event of the scene
    const obj = new CSS2DObject(div);
    obj.name = Measure.LABEL_NAME;
    return obj;
  }

  /**
   * Creates the arc curve to indicate the angle in degree
   */
  createCurve(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
    const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
    const points = curve.getPoints(4); // get points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const obj = new THREE.Line(geometry, Measure.LINE_MATERIAL);
    obj.name = Measure.OBJ_NAME;
    return obj;
  }

  /**
   * Calculates area
   * TODO: for concave polygon, the value doesn't right, need to fix it
   * @param points
   */
  calculateArea(points: THREE.Vector3[]) {
    let area = 0;
    for (let i = 0, j = 1, k = 2; k < points.length; j++, k++) {
      const a = points[i].distanceTo(points[j]);
      const b = points[j].distanceTo(points[k]);
      const c = points[k].distanceTo(points[i]);
      const p = (a + b + c) / 2;
      area += Math.sqrt(p * (p - a) * (p - b) * (p - c));
    }
    return area;
  }

  /**
   * Gets included angle of two lines in degree
   */
  calculateAngle(startPoint: THREE.Vector3, middlePoint: THREE.Vector3, endPoint: THREE.Vector3) {
    const p0 = startPoint;
    const p1 = middlePoint;
    const p2 = endPoint;
    const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z);
    const dir1 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const angle = dir0.angleTo(dir1);
    return angle * 180 / Math.PI; // convert to degree
  }

  /**
   * Gets angle bisector of two lines
   */
  getAngleBisector(startPoint: THREE.Vector3, middlePoint: THREE.Vector3, endPoint: THREE.Vector3): THREE.Vector3 {
    const p0 = startPoint;
    const p1 = middlePoint;
    const p2 = endPoint;
    const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize();
    const dir2 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
    return new THREE.Vector3(dir0.x + dir2.x, dir0.y + dir2.y, dir0.z + dir2.z).normalize(); // the middle direction between dir0 and dir2
  }

  /**
   * Get the barycenter of points
   */
  getBarycenter(points: THREE.Vector3[]): THREE.Vector3 {
    const l = points.length;
    let x = 0;
    let y = 0;
    let z = 0;
    points.forEach(p => { x += p.x; y += p.y; z += p.z });
    return new THREE.Vector3(x / l, y / l, z / l);
  }

  /**
   * Gets unit string for distance, area or angle
   */
  getUnitString() {
    if (this.mode === MeasureMode.Distance) return getUnitStr(this.settings.unit);
    if (this.mode === MeasureMode.Area) return `${getUnitStr(this.settings.unit, 2)}`;
    if (this.mode === MeasureMode.Angle) return "°";
    return "";
  }

  /**
   * Converts a number to a string with proper fraction digits
   */
  numberToString(num: number) {
    if (num < 0.0001) {
      return num.toString();
    }
    let fractionDigits = 2;
    if (num < 0.01) {
      fractionDigits = 4;
    } else if (num < 0.1) {
      fractionDigits = 3;
    }
    return num.toFixed(fractionDigits);
  }
}
