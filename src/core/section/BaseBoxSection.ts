import { Box3, Scene, WebGLRenderer, Vector3, Mesh, MeshBasicMaterial, Vector2, Raycaster, PerspectiveCamera, Group, LineSegments, LineBasicMaterial, Plane, PlaneGeometry, BackSide, BufferGeometry, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// Note: this code is originally from https://github.com/screamsyk/three.js-clipping

/**
 * Object's box section
 */
export class BaseBoxSection {
  static MIN_WIDTH = 1; // min width of section box
  // basic member data
  public isOpen: boolean = false;
  protected sectionBox?: Box3;
  protected scene: Scene;
  protected camera: PerspectiveCamera | OrthographicCamera;
  protected renderer: WebGLRenderer;
  protected controls: OrbitControls;

  /**
   * Constructor
   * @param scene
   * @param camera
   * @param renderer
   * @param controls
   */
  constructor(scene: Scene, camera: PerspectiveCamera | OrthographicCamera, renderer: WebGLRenderer, controls: OrbitControls) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
  }

  /**
   * If sectionBox is not assigned in constructor, then set it here.
   * For now, we only support it to be set once. Otherwise, need to check isOpen status, and initSectionBox properly.
   * @param sectionBox
   */
  protected setSectionBox(sectionBox: Box3) {
    if (this.sectionBox) {
      throw new Error("sectionBox is assigned already!");
    }
    this.sectionBox = sectionBox;
  }

  /**
   * Starts to clip
   */
  open() {
    this.initSectionBox();
    this.addMouseListener();
    this.isOpen = true;
  }

  /**
   * Close clipper
   */
  close() {
    this.isOpen = false;
    this.removeMouseListener();
    this.clearSectionBox();
  }

  /**
   * reset clipper
   */
  reset() {
    this.close();
    this.open();
  }

  // --------------- Clipping box --------------------

  // basic data member
  protected boxMin: Vector3 = new Vector3(); // min point of section box
  protected boxMax: Vector3 = new Vector3(); // max point of section box
  protected group: Group = new Group(); // contains any object for section
  protected planes: Array<Plane> = []; // section planes
  protected vertices = [
    new Vector3(), new Vector3(), new Vector3(), new Vector3(), // 4 vertices at the top
    new Vector3(), new Vector3(), new Vector3(), new Vector3() // 4 vertices at the bottom
  ];

  protected faces: Array<BoxFace> = []; // eslint-disable-line
  protected lines: Array<BoxLine> = []; // eslint-disable-line

  /**
   * Initialize clip box
   */
  protected initSectionBox() {
    if (!this.sectionBox) {
      throw new Error("Need to set sectionBox first!");
    }
    this.boxMin = this.sectionBox.min;
    this.boxMax = this.sectionBox.max;
    this.group = new Group();
    this.initPlanes();
    this.initOrUpdateVertices();
    this.initOrUpdateFaces();
    this.initOrUpdateLines();
    this.scene.add(this.group);
  }

  /**
   * Initialize 6 section plane
   */
  protected initPlanes() {
    this.planes = [];
    this.planes.push(
      new Plane(new Vector3(0, -1, 0), this.boxMax.y), // up
      new Plane(new Vector3(0, 1, 0), -this.boxMin.y), // down
      new Plane(new Vector3(1, 0, 0), -this.boxMin.x), // left
      new Plane(new Vector3(-1, 0, 0), this.boxMax.x), // right
      new Plane(new Vector3(0, 0, -1), this.boxMax.z), // front
      new Plane(new Vector3(0, 0, 1), -this.boxMin.z) // back
    );
  }

  protected updatePlanes() {
    this.planes[0].constant = this.boxMax.y;
    this.planes[1].constant = -this.boxMin.y;
    this.planes[2].constant = -this.boxMin.x;
    this.planes[3].constant = this.boxMax.x;
    this.planes[4].constant = this.boxMax.z;
    this.planes[5].constant = -this.boxMin.z;
  }

  /**
   * Initialize or update 8 vertices of section box
   */
  protected initOrUpdateVertices() {
    this.vertices[0].set(this.boxMin.x, this.boxMax.y, this.boxMin.z); // 4 vertices at the top
    this.vertices[1].set(this.boxMax.x, this.boxMax.y, this.boxMin.z);
    this.vertices[2].set(this.boxMax.x, this.boxMax.y, this.boxMax.z);
    this.vertices[3].set(this.boxMin.x, this.boxMax.y, this.boxMax.z);
    this.vertices[4].set(this.boxMin.x, this.boxMin.y, this.boxMin.z); // 4 vertices at the bottom
    this.vertices[5].set(this.boxMax.x, this.boxMin.y, this.boxMin.z);
    this.vertices[6].set(this.boxMax.x, this.boxMin.y, this.boxMax.z);
    this.vertices[7].set(this.boxMin.x, this.boxMin.y, this.boxMax.z);
  }

  /**
   * Initialize 6 faces of section box
   */
  protected initOrUpdateFaces() {
    const v = this.vertices;
    if (!this.faces || this.faces.length === 0) {
      this.faces = [];
      this.faces.push(
        new BoxFace("yUp", [v[0], v[1], v[2], v[3]]), // up
        new BoxFace("yDown", [v[4], v[7], v[6], v[5]]), // down
        new BoxFace("xLeft", [v[0], v[3], v[7], v[4]]), // left
        new BoxFace("xRight", [v[1], v[5], v[6], v[2]]), // right
        new BoxFace("zFront", [v[2], v[6], v[7], v[3]]), // front
        new BoxFace("zBack", [v[0], v[4], v[5], v[1]]) // back
      );
      this.group.add(...this.faces);
      this.faces.forEach(face => {
        this.group.add(face.backFace);
      });
    } else {
      const f = this.faces;
      f[0].setFromPoints([v[0], v[1], v[2], v[3]]);
      f[1].setFromPoints([v[4], v[7], v[6], v[5]]);
      f[2].setFromPoints([v[0], v[3], v[7], v[4]]);
      f[3].setFromPoints([v[1], v[5], v[6], v[2]]);
      f[4].setFromPoints([v[2], v[6], v[7], v[3]]);
      f[5].setFromPoints([v[0], v[4], v[5], v[1]]);
    }
  }

  /**
   * Initialize 12 lines of section box
   */
  protected initOrUpdateLines() {
    const v = this.vertices;
    if (!this.lines || this.lines.length === 0) {
      const f = this.faces;
      if (!f) {
        throw Error("Need to init Face first!");
      }
      this.lines = [];
      this.lines.push(
        new BoxLine([v[0], v[1]], [f[0], f[5]]),
        new BoxLine([v[1], v[2]], [f[0], f[3]]),
        new BoxLine([v[2], v[3]], [f[0], f[4]]),
        new BoxLine([v[3], v[0]], [f[0], f[2]]),
        new BoxLine([v[4], v[5]], [f[1], f[5]]),
        new BoxLine([v[5], v[6]], [f[1], f[3]]),
        new BoxLine([v[6], v[7]], [f[1], f[4]]),
        new BoxLine([v[7], v[4]], [f[1], f[2]]),
        new BoxLine([v[0], v[4]], [f[2], f[5]]),
        new BoxLine([v[1], v[5]], [f[3], f[5]]),
        new BoxLine([v[2], v[6]], [f[3], f[4]]),
        new BoxLine([v[3], v[7]], [f[2], f[4]])
      );
      this.group.add(...this.lines);
    } else {
      let i = 0;
      this.lines[i++].setFromPoints([v[0], v[1]]);
      this.lines[i++].setFromPoints([v[1], v[2]]);
      this.lines[i++].setFromPoints([v[2], v[3]]);
      this.lines[i++].setFromPoints([v[3], v[0]]);
      this.lines[i++].setFromPoints([v[4], v[5]]);
      this.lines[i++].setFromPoints([v[5], v[6]]);
      this.lines[i++].setFromPoints([v[6], v[7]]);
      this.lines[i++].setFromPoints([v[7], v[4]]);
      this.lines[i++].setFromPoints([v[0], v[4]]);
      this.lines[i++].setFromPoints([v[1], v[5]]);
      this.lines[i++].setFromPoints([v[2], v[6]]);
      this.lines[i++].setFromPoints([v[3], v[7]]);
    }
  }

  /**
   * Clears clip box
   */
  protected clearSectionBox() {
    this.scene.remove(this.group);
    this.renderer.domElement.style.cursor = "";
  }

  // ------------------- Mouse events -----------------------

  // basic data member
  protected raycaster: Raycaster = new Raycaster();
  protected mousePosition: Vector2 = new Vector2();
  // the face that the mouse is hovering
  protected activeFace: BoxFace | null = null; // eslint-disable-line

  /**
   * Adds mouse event listener
   */
  private addMouseListener() {
    window.addEventListener("pointermove", this.onMouseMove);
    window.addEventListener("pointerdown", this.onMouseDown);
  }

  /**
   * Removes mouse event listener
   */
  private removeMouseListener() {
    window.removeEventListener("pointermove", this.onMouseMove);
    window.removeEventListener("pointerdown", this.onMouseDown);
  }

  /**
   * Converts mouse coordinates, and updates raycaster
   */
  protected updateMouseAndRay(event: MouseEvent) {
    this.mousePosition.setX((event.clientX / window.innerWidth) * 2 - 1);
    this.mousePosition.setY(-(event.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
  }

  /**
   * Handles mouse move event, highlights corresponding face/lines properly
   */
  protected onMouseMove = (event: MouseEvent) => {
    this.updateMouseAndRay(event);
    const intersects = this.raycaster.intersectObjects(this.faces); // intersects for mouse and faces
    if (intersects.length) {
      this.renderer.domElement.style.cursor = "pointer";
      const face = intersects[0].object as BoxFace;
      if (face !== this.activeFace) {
        if (this.activeFace) {
          this.activeFace.setActive(false);
        }
        face.setActive(true);
        this.activeFace = face;
      }
    } else {
      if (this.activeFace) {
        this.activeFace.setActive(false);
        this.activeFace = null;
        this.renderer.domElement.style.cursor = "auto";
      }
    }
  };

  /**
   * Handles mouse down event, starts to drag a face using left button
   */
  protected onMouseDown = (event: MouseEvent) => {
    const isLeftButton = event.button === 0; // 0: left button, 1: middle button, 2: right button
    if (this.activeFace && isLeftButton) {
      this.updateMouseAndRay(event);
      const intersects = this.raycaster.intersectObjects(this.faces); // intersects for mouse and faces
      if (intersects.length) {
        const face = intersects[0].object as BoxFace;
        const axis = face.axis;
        const point = intersects[0].point;
        this.drag.start(axis, point);
      }
    }
  };

  /**
   * The drag object, used to handle clip operation
   */
  protected drag = {
    axis: "", // one of the 6 axis to be dragged
    point: new Vector3(), // to record where the drag point is
    ground: new Mesh(new PlaneGeometry(1000000, 1000000), new MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
    start: (axis: string, point: Vector3) => {
      this.drag.axis = axis;
      this.drag.point = point;
      this.drag.initGround();
      this.controls.enablePan = false;
      this.controls.enableZoom = false;
      this.controls.enableRotate = false;
      this.renderer.domElement.style.cursor = "move";
      // mouseup/mousedown/mousemove event is prevented by OrbitControls, let's use pointerup/pointerdown/pointermove
      window.removeEventListener("pointermove", this.onMouseMove);
      window.addEventListener("pointermove", this.drag.mousemove);
      window.addEventListener("pointerup", this.drag.mouseup);
    },
    end: () => {
      this.scene.remove(this.drag.ground);
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;
      window.removeEventListener("pointermove", this.drag.mousemove);
      window.removeEventListener("pointerup", this.drag.mouseup);
      window.addEventListener("pointermove", this.onMouseMove);
    },
    mousemove: (event: MouseEvent) => {
      this.updateMouseAndRay(event);
      const intersects = this.raycaster.intersectObject(this.drag.ground); // 鼠标与拖动地面的相交情况
      if (intersects.length) {
        this.drag.updateSectionBox(intersects[0].point);
      }
    },
    mouseup: () => {
      this.drag.end();
    },
    // Initialize the reference plane while dragging, which can be XY, YZ, ZX plane
    initGround: () => {
      const normals: any = {
        xLeft: new Vector3(-1, 0, 0),
        xRight: new Vector3(1, 0, 0),
        yDown: new Vector3(0, -1, 0),
        yUp: new Vector3(0, 1, 0),
        zBack: new Vector3(0, 0, -1),
        zFront: new Vector3(0, 0, 1)
      };
      if (["xLeft", "xRight"].includes(this.drag.axis)) {
        this.drag.point.setX(0);
      } else if (["yDown", "yUp"].includes(this.drag.axis)) {
        this.drag.point.setY(0);
      } else if (["zBack", "zFront"].includes(this.drag.axis)) {
        this.drag.point.setZ(0);
      }
      this.drag.ground.position.copy(this.drag.point);
      const newNormal = this.camera.position.clone()
        .sub(this.camera.position.clone().projectOnVector(normals[this.drag.axis]))
        .add(this.drag.point); // gets the normal of the plane
      this.drag.ground.lookAt(newNormal);
      this.scene.add(this.drag.ground);
    },
    // updates section box, thus applies section
    updateSectionBox: (point: Vector3) => {
      const minSize = BaseBoxSection.MIN_WIDTH; // min size of section box
      switch (this.drag.axis) {
        case "yUp": // up
          this.boxMax.setY(Math.max(this.boxMin.y + minSize, point.y));
          break;
        case "yDown": // down
          this.boxMin.setY(Math.min(this.boxMax.y - minSize, point.y));
          break;
        case "xLeft": // left
          this.boxMin.setX(Math.min(this.boxMax.x - minSize, point.x));
          break;
        case "xRight": // right
          this.boxMax.setX(Math.max(this.boxMin.x + minSize, point.x));
          break;
        case "zFront": // front
          this.boxMax.setZ(Math.max(this.boxMin.z + minSize, point.z));
          break;
        case "zBack": // back
          this.boxMin.setZ(Math.min(this.boxMax.z - minSize, point.z));
          break;
      }

      // updates section box's planes, vertices, faces and lines
      // this.initPlanes()
      this.updatePlanes();
      this.initOrUpdateVertices();
      this.initOrUpdateFaces();
      this.initOrUpdateLines();
    }
  };
}

/**
 * BoxLine of a section box
 */
class BoxLine extends LineSegments {
  // basic data member
  private normalMaterial = new LineBasicMaterial({ color: 0x795548 }); // 0xffa080, normal color of line (original color: 0xe1f2fb)
  private activeMaterial = new LineBasicMaterial({ color: 0x4e342e }); // 0xff5000, active color of line (original color: 0x00ffff)

  /**
   * @param vertices two points of a line
   * @param faces two faces relative to a line
   */
  constructor(vertices: Array<Vector3>, faces: Array<BoxFace>) {
    super();
    faces.forEach(face => face.lines.push(this)); // saves the relationship between face and line
    this.geometry = new BufferGeometry();
    this.geometry.setFromPoints(vertices);
    this.material = this.normalMaterial;
  }

  /**
   * Updates geometry
   */
  setFromPoints(vertices: Vector3[]) {
    this.geometry.setFromPoints(vertices);
  }

  /**
   * Sets to active or inactive
   * @param isActive
   */
  setActive(isActive: boolean) {
    this.material = isActive ? this.activeMaterial : this.normalMaterial;
  }
}

/**
 * BoxFace of a section box
 */
class BoxFace extends Mesh {
  // basic data member
  axis: string;
  lines: Array<BoxLine> = []; // 4 lines relative to a face
  backFace: Mesh; // the back side of a face, used to display

  /**
   * @param axis axis of a face
   * @param vertices 4 points of a face
   */
  constructor(axis: string, vertices: Array<Vector3>) {
    super();
    this.axis = axis;
    this.lines = [];
    this.geometry = new BufferGeometry();
    this.geometry.setFromPoints(vertices);
    this.geometry.setIndex([0, 3, 2, 0, 2, 1]);
    this.geometry.computeVertexNormals();
    this.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const backMaterial = new MeshBasicMaterial({ color: 0xb1bfcb, transparent: true, opacity: 0.3, side: BackSide });
    this.backFace = new Mesh(this.geometry, backMaterial);
  }

  /**
   * Updates geometry
   */
  setFromPoints(vertices: Vector3[]) {
    this.geometry.setFromPoints(vertices);
  }

  /**
   * Sets to active or inactive
   * @param isActive
   */
  setActive(isActive: boolean) {
    this.lines.forEach(line => { line.setActive(isActive) });
  }
}
