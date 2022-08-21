import * as THREE from "three";
import { Box3, Scene, WebGLRenderer, Vector3, Mesh, MeshBasicMaterial, Matrix4, Vector2, Raycaster, PerspectiveCamera, Group, LineSegments, LineBasicMaterial, Plane, PlaneGeometry, DoubleSide, BufferGeometry, OrthographicCamera } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Object's plane section
 */
export class BasePlaneSection {
  static MIN_WIDTH = 1; // min width of section plane
  // basic member data
  public isOpen = false;
  protected boundingBox?: Box3;
  protected scene: Scene;
  protected camera: PerspectiveCamera | OrthographicCamera;
  protected renderer: WebGLRenderer;
  protected controls: OrbitControls;
  protected isSectionObjectVisible = true;
  // matrix for section planes, etc.
  protected matrix?: Matrix4;

  /**
   * Constructor
   */
  constructor(scene: Scene, camera: PerspectiveCamera | OrthographicCamera, renderer: WebGLRenderer, controls: OrbitControls) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
  }

  /**
   * If plane is not assigned in constructor, then set it here.
   * For now, we only support it to be set once. Otherwise, need to check isOpen status, and initSectionPlane properly.
   */
  protected setSectionPlane(box: Box3) {
    if (this.boundingBox) {
      throw new Error("boundingBox is assigned already!");
    }
    const y = (box.min.y + box.max.y) / 2; // section at the middle by default
    this.boxMin.set(box.min.x, y, box.min.z);
    this.boxMax.set(box.max.x, y, box.max.z);
  }

  /**
   * Sets section object's visibility, in case caller don't want to see it
   */
  public setSectionObjectVisible(visilbe: boolean) {
    this.isSectionObjectVisible = visilbe;
    // if sub objects are initialized already, set their visibility
    if (this.group) {
      this.group.traverse(object => { object.visible = visilbe });
    }
  }

  /**
   * Starts to section
   */
  open() {
    this.initSectionPlane();
    this.setSectionObjectVisible(this.isSectionObjectVisible);
    this.addMouseListener();
    this.isOpen = true;
  }

  /**
   * Close section
   */
  close() {
    this.isOpen = false;
    this.removeMouseListener();
    this.clearSectionPlane();
  }

  /**
   * reset section
   */
  reset() {
    this.close();
    this.open();
  }

  /**
   * Sets a matrix for section planes, which constains rotation on x, y, z, scale, etc.
   * Should call this after initSectionPlane() is called.
   * The rotation can be any value, but the editor (drag tool) doesn't work well when rotation is too big!
   * So, we'd better to limmit user from applying a big value.
   */
  public setMatrix(matrix: Matrix4) {
    this.group.applyMatrix4(matrix);
    this.planes.forEach(plane => plane.applyMatrix4(matrix));
  }

  // --------------- Sectionping plane ------------------
  protected boxMin: Vector3 = new Vector3(); // min point of section plane, use its 'y' for constrant
  protected boxMax: Vector3 = new Vector3(); // max point of section plane (ignore its y)
  protected group: Group = new Group(); // contains any object for section
  protected planes: Plane[] = []; // section plane
  protected vertices = [
    new Vector3(), new Vector3(), new Vector3(), new Vector3() // yUp
  ];

  protected controllerMarkers: THREE.Sprite[] = [];
  protected face?: BoxFace; // eslint-disable-line
  protected lines: BoxLine[] = []; // eslint-disable-line
  readonly normalMarkerOpacity = 0.5;
  readonly activeMarkerOpacity = 1;
  readonly normalColor = 0x4e342e; // 0xffa080
  readonly activeColor = 0x4e342e; // 0xff5000

  /**
   * Initialize section plane
   */
  protected initSectionPlane() {
    this.group = new Group();
    this.initPlanes();
    this.initOrUpdateVertices();
    this.initOrUpdateFace(); // init face before lines
    this.initOrUpdateLines();
    this.scene.add(this.group);
  }

  /**
   * Initialize section planes
   */
  protected initPlanes() {
    this.planes = [];
    this.planes.push(
      // for a section panel, objects in a direction/normal is visible
      new Plane(new Vector3(0, -1, 0)), // up
      new Plane(new Vector3(-1, 0, 0)), // xLeft
      new Plane(new Vector3(0, 0, 1)), // zFront
      new Plane(new Vector3(1, 0, 0)), // xRight
      new Plane(new Vector3(0, 0, -1)) // zBack
    );
    this.updatePlanes();
  }

  /**
   * Updates planes for section plane
   */
  protected updatePlanes() {
    this.planes[0].constant = this.boxMax.y;
    this.planes[1].constant = this.boxMin.x;
    this.planes[2].constant = -this.boxMax.z; // why need to be nagetive??
    this.planes[3].constant = -this.boxMax.x;
    this.planes[4].constant = this.boxMin.z;
  }

  /**
   * Initialize or update 4 vertices of section plane
   */
  protected initOrUpdateVertices() {
    const y = this.boxMax.y; // y is always the same as it's a plane
    this.vertices[0].set(this.boxMin.x, y, this.boxMin.z);
    this.vertices[1].set(this.boxMin.x, y, this.boxMax.z);
    this.vertices[2].set(this.boxMax.x, y, this.boxMax.z);
    this.vertices[3].set(this.boxMax.x, y, this.boxMin.z);

    const createOrUpdateControllerMarker = (v1: Vector3, v2: Vector3, marker: THREE.Sprite | undefined = undefined, name?: string) => {
      if (marker) {
        marker.position.set((v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2);
      } else {
        const position = new Vector3((v1.x + v2.x) / 2, (v1.y + v2.y) / 2, (v1.z + v2.z) / 2);
        const marker = this.createPointMarker(position, name);
        this.controllerMarkers.push(marker);
        this.group.add(marker);
      }
    };

    const v = this.vertices;
    if (this.controllerMarkers.length === 0) {
      createOrUpdateControllerMarker(v[0], v[1], undefined, "xLeft");
      createOrUpdateControllerMarker(v[1], v[2], undefined, "zFront");
      createOrUpdateControllerMarker(v[2], v[3], undefined, "xRight");
      createOrUpdateControllerMarker(v[3], v[0], undefined, "zBack");
    } else {
      createOrUpdateControllerMarker(v[0], v[1], this.controllerMarkers[0]);
      createOrUpdateControllerMarker(v[1], v[2], this.controllerMarkers[1]);
      createOrUpdateControllerMarker(v[2], v[3], this.controllerMarkers[2]);
      createOrUpdateControllerMarker(v[3], v[0], this.controllerMarkers[3]);
    }
  }

  /**
   * Initialize 1 face of section plane
   */
  protected initOrUpdateFace() {
    const v = this.vertices;
    if (!this.face) {
      let i = 0;
      this.face = new BoxFace("yUp", [v[i++], v[i++], v[i++], v[i++]]); // up
      this.group.add(this.face);
    } else {
      this.face.setFromPoints(v);
    }
  }

  /**
   * Initialize 4 lines of section plane
   */
  protected initOrUpdateLines() {
    const v = this.vertices;
    if (!this.lines || this.lines.length === 0) {
      const f = this.face;
      if (!f) {
        throw Error("Need to init Face first!");
      }
      this.lines = [];
      this.lines.push(
        new BoxLine([v[0], v[1]], [f]),
        new BoxLine([v[1], v[2]], [f]),
        new BoxLine([v[2], v[3]], [f]),
        new BoxLine([v[3], v[0]], [f])
      );
      this.group.add(...this.lines);
    } else {
      let i = 0;
      this.lines[i].setFromPoints([v[i], v[++i]]);
      this.lines[i].setFromPoints([v[i], v[++i]]);
      this.lines[i].setFromPoints([v[i], v[++i]]);
      this.lines[i].setFromPoints([v[i], v[0]]);
    }
  }

  /**
   * Clears section plane
   */
  protected clearSectionPlane() {
    this.scene.remove(this.group);
    this.renderer.domElement.style.cursor = "";
  }

  // ------------------- Mouse events -----------------------

  // basic data member
  protected raycaster: Raycaster = new Raycaster();
  protected mousePosition: Vector2 = new Vector2();
  // the face that the mouse is hovering
  protected activeFace: BoxFace | undefined = undefined; // eslint-disable-line
  protected activeMarker: THREE.Sprite | undefined = undefined;

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
    if (!this.isSectionObjectVisible) {
      return;
    }
    this.updateMouseAndRay(event);
    const intersects = this.raycaster.intersectObject(this.group, true); // intersects for mouse and faces
    if (intersects.length) {
      this.renderer.domElement.style.cursor = "pointer";
      const markers = intersects.filter(i => {
        return i && i.object && i.object instanceof THREE.Sprite;
      });
      const faces = intersects.filter(i => {
        return i && i.object && i.object instanceof BoxFace;
      });
      if (markers.length > 0) {
        this.activeMarker = markers[0].object as THREE.Sprite;
        this.activeMarker.material.opacity = this.activeMarkerOpacity;
        this.activeMarker.material.color.set(this.activeColor);
      } else if (this.activeMarker) {
        this.activeMarker.material.opacity = this.normalMarkerOpacity;
        this.activeMarker.material.color.set(this.normalColor);
        this.activeMarker = undefined;
      }
      if (faces.length > 0 && !this.activeMarker) {
        const face = faces[0].object as BoxFace;
        if (face !== this.activeFace) {
          if (this.activeFace) {
            this.activeFace.setActive(false);
          }
          face.setActive(true);
          this.activeFace = face;
        }
      } else if (this.activeFace) {
        this.activeFace.setActive(false);
        this.activeFace = undefined;
      }
      if (!this.activeMarker && !this.activeFace) {
        this.renderer.domElement.style.cursor = "auto";
      }
    }
  };

  /**
   * Handles mouse down event, starts to drag a face using left button
   */
  protected onMouseDown = (event: MouseEvent) => {
    if (!this.isSectionObjectVisible) {
      return;
    }
    const isLeftButton = event.button === 0; // 0: left button, 1: middle button, 2: right button
    if (!isLeftButton) {
      return;
    }
    if (this.activeMarker) {
      this.updateMouseAndRay(event);
      const intersects = this.raycaster.intersectObject(this.group, true); // intersects for mouse and faces
      if (intersects.length) {
        const axis = this.activeMarker.name;
        const point = intersects[0].point;
        this.drag.start(axis, point);
      }
    } else if (this.activeFace && this.face) {
      this.updateMouseAndRay(event);
      const intersects = this.raycaster.intersectObject(this.face); // intersects for mouse and faces
      if (intersects.length) {
        const face = intersects[0].object as BoxFace;
        const axis = face.axis;
        const point = intersects[0].point;
        this.drag.start(axis, point);
      }
    }
  };

  /**
   * The drag object, used to handle section operation
   */
  protected drag = {
    axis: "", // the axis to be dragged
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
        this.drag.updateSectionPlane(intersects[0].point);
      }
    },
    mouseup: () => {
      this.drag.end();
    },
    // Initialize the reference plane while dragging
    initGround: () => {
      const axis = this.drag.axis;
      const normals: any = {
        yUp: new Vector3(0, 1, 0),
        xLeft: new Vector3(-1, 0, 0),
        zFront: new Vector3(0, 0, 1),
        xRight: new Vector3(1, 0, 0),
        zBack: new Vector3(0, 0, -1)
      };
      if (["xLeft", "xRight"].includes(axis)) {
        this.drag.point.setX(0);
      } else if (["yUp"].includes(axis)) {
        this.drag.point.setY(0);
      } else if (["zBack", "zFront"].includes(axis)) {
        this.drag.point.setZ(0);
      }
      this.drag.ground.position.copy(this.drag.point);
      const newNormal = this.camera.position.clone()
        .sub(this.camera.position.clone().projectOnVector(normals[axis]))
        .add(this.drag.point); // gets the normal of the plane
      this.drag.ground.lookAt(newNormal);
      this.scene.add(this.drag.ground);
    },
    // updates section plane, thus applies section
    updateSectionPlane: (point: Vector3) => {
      const axis = this.drag.axis;
      const minSize = BasePlaneSection.MIN_WIDTH; // min size of section box
      switch (axis) {
        case "yUp": // up
          this.boxMax.y = point.y;
          this.boxMin.y = point.y;
          // this.boxMax.setY(Math.max(this.boxMin.y + minSize, point.y))
          break;
        case "xLeft": // xLeft
          this.boxMin.setX(Math.min(this.boxMax.x - minSize, point.x));
          break;
        case "zFront": // zFront
          this.boxMax.setZ(Math.max(this.boxMin.z + minSize, point.z));
          break;
        case "xRight": // xRight
          this.boxMax.setX(Math.max(this.boxMin.x + minSize, point.x));
          break;
        case "zBack": // zBack
          this.boxMin.setZ(Math.min(this.boxMax.z - minSize, point.z));
          break;
      }

      // updates section plane, vertices, faces and lines
      this.updatePlanes();
      this.initOrUpdateVertices();
      this.initOrUpdateFace();
      this.initOrUpdateLines();
    }
  };

  spriteMaterial?: THREE.SpriteMaterial;

  /**
   * Initializes point marker material
   */
  initPointMarkerMaterial() {
    const markerTexture = new THREE.TextureLoader().load("images/circle.png");
    this.spriteMaterial = new THREE.SpriteMaterial({
      map: markerTexture,
      color: this.normalColor,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: this.normalMarkerOpacity
    });
  }

  /**
   * Creates point marker
   */
  private createPointMarker(position?: THREE.Vector3, name: string = ""): THREE.Sprite {
    if (!this.spriteMaterial) {
      this.initPointMarkerMaterial();
    }
    const p = position;
    const scale = 0.015;
    const obj = new THREE.Sprite(this.spriteMaterial);
    obj.scale.set(scale, scale, scale);
    if (p) {
      obj.position.set(p.x, p.y, p.z);
    }
    obj.name = name;
    return obj;
  }
}

/**
 * BoxLine of a section plane
 */
class BoxLine extends LineSegments {
  // basic data member
  private normalMaterial = new LineBasicMaterial({ color: 0x795548 }); // normal color of line (original color: 0xe1f2fb)
  private activeMaterial = new LineBasicMaterial({ color: 0x4e342e }); // active color of line (original color: 0x00ffff)

  /**
   * @param vertices two points of a line
   * @param faces two faces relative to a line
   */
  constructor(vertices: Vector3[], faces: BoxFace[]) {
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
 * BoxFace of a section plane
 */
class BoxFace extends Mesh {
  // basic data member
  axis: string;
  lines: BoxLine[] = []; // 4 lines relative to a face

  /**
   * @param axis axis of a face
   * @param vertices 4 points of a face
   */
  constructor(axis: string, vertices: Vector3[]) {
    super();
    this.axis = axis;
    this.lines = [];
    this.geometry = new BufferGeometry();
    this.geometry.setFromPoints(vertices);
    this.geometry.setIndex([0, 3, 2, 0, 2, 1]);
    this.geometry.computeVertexNormals();
    this.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide });
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
