import * as THREE from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { Collada, ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { IFCLoader } from "three/examples/jsm/loaders/IFCLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";
import { BloomPass } from "three/examples/jsm/postprocessing/BloomPass";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass";
import { SSAARenderPass } from "three/examples/jsm/postprocessing/SSAARenderPass";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ObjectsBoxSection } from "./section/ObjectsBoxSection";
import { ObjectsPlaneSection } from "./section/ObjectsPlaneSection";
import { LineBasicMaterial, Material, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, Raycaster, Vector3 } from "three";
import { MaterialInfo, ObjectUtils } from "./utils/ObjectUtils";
import { Settings as SettingsType, defaultSettings, CameraSettings } from "@/components/projectSettingsPanel/ProjectSettingsDef";
import { PostmateManager } from "./postmate/PostmateManager";
import { BooleanMessageData, MessageId } from "./postmate/Message";
import { SHPLoader } from "./shp-js/SHPLoader";
import { Model, ProjectManager } from "./ProjectManager";
import { matrixAutoUpdate } from "@/core/Constants";
import { WebCam } from "./webcam/WebCam";
import CommonUtils from "./utils/CommonUtils";
import DatGuiHelper from "./helpers/DatGuiHelper";
import DeviceUtils from "./utils/DeviceUtils";
import GroundUtils from "./utils/GroundUtils";
import InstantiateHelper from "./helpers/InstantiateHelper";
import Measure, { MeasureMode } from "./measure/Measure";
import MergeHelper from "./helpers/MergeHelper";
import RafHelper from "./helpers/RafHelper";
import Stats from "three/examples/jsm/libs/stats.module";
import SkyboxUtils from "./utils/SkyboxUtils";
import store from "../store/index";
import Viewer3DUtils, { Views } from "./utils/Viewer3DUtils";
// eslint-disable-next-line
const TWEEN = require('tween')

const decoderPath = "three/js/libs/draco/gltf/";
export default class Viewer3D {
  camera?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  scene?: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  css2dRenderer?: CSS2DRenderer; // used to render html labels in the scene
  ambientLight?: THREE.AmbientLight;
  directionalLight?: THREE.DirectionalLight;
  hemisphereLight?: THREE.HemisphereLight;
  controls?: OrbitControls;
  selectedObject: any | undefined = undefined;
  groundGrid?: THREE.Line;
  grassGround?: THREE.Mesh;
  sceneBackgroundColor: THREE.Color = new THREE.Color(0xebf2f7); // TODO: add it to settings
  skyOfGradientRamp?: THREE.Mesh;
  stats?: Stats;
  loadedModels: { [src: string]: { uuid: string, bbox?: THREE.BoxHelper } } = {}; // a map to store model file and uuid
  [propertyName: string]: any // any property name
  private perspectiveCamera?: THREE.PerspectiveCamera;
  private orthoCamera?: THREE.OrthographicCamera;
  private perspectiveCameraControls?: OrbitControls;
  private orthoCameraConrols?: OrbitControls;
  private composerRenderEnabled = true; // if we should call composer.render() in render()
  private composerEnabled = false; // if composer and passes are enabled
  private composer?: EffectComposer;
  private renderPass?: RenderPass;
  private effectFxaaPass?: ShaderPass;
  private ssaoPass?: SSAOPass | ShaderPass;
  private saoPass?: SAOPass;
  private outlinePass?: OutlinePass;
  private ssaaRenderPass?: SSAARenderPass;
  private bloomPass?: BloomPass;
  private unrealBloomPass?: UnrealBloomPass;
  private height = 0;
  private width = 0;
  private raycaster?: THREE.Raycaster;
  private tween?: any; // TWEEN.Tween
  private savedMaterialsForOpacity?: MaterialInfo[] = [];
  private mouseMoved = false;
  private mouseDoubleClicked = false;
  private section?: ObjectsBoxSection | ObjectsPlaneSection;
  private measure?: Measure;
  private datGui?: DatGuiHelper;
  private gltfLoader?: GLTFLoader;
  private webcam?: WebCam;
  private webcamPlane?: THREE.Mesh;
  // RafHelper (requestAnimationFrame Helper) is used to improve render performance,
  // With this feature, it only renders when necessary, e.g. camera position changed, model loaded, etc.
  // We can disable this feature by assigning raf to undefined
  private raf?: RafHelper = new RafHelper();
  private renderEnabled = true; // used together with RafHelper
  private timeoutSymbol?: symbol; // used together with RafHelper
  private isFrustumInsectChecking = false;
  // store events so that they can be removed before destroy
  private events: { node: any, type: string, func: any }[] = [];
  private settings: SettingsType;
  private readonly postmate = PostmateManager.instance();

  constructor(width: number, height: number, settings: SettingsType = defaultSettings) {
    this.width = width;
    this.height = height;
    this.settings = settings;
    this.init();
  }

  /**
   * Initialize everything it needs
   */
  init() {
    this.initScene();
    this.initRenderer();
    this.initCamera();
    this.initControls();
    this.initLights();
    this.initPointerEvents();
    this.initDatGui(); // should be initialized later than sky, ground grid, etc.
    this.initPostmate();
    this.initOthers();
  }

  private initScene() {
    this.scene = new THREE.Scene();
    // this.scene.background = new THREE.Color(0xebf2f7)

    // Find more performance tips at: https://discoverthreejs.com/tips-and-tricks/
    // For performance. call .updateMatrix() manually when needed.
    this.scene.matrixAutoUpdate = matrixAutoUpdate;
    // When testing the performance of your apps, one of the first things you’ll need to do is check whether it is CPU bound, or GPU bound.
    // If performance increases, then your app is GPU bound. If performance doesn’t increase, your app is CPU bound.
    // this.scene.overrideMaterial = new MeshBasicMaterial({ color: 'green' })
  }

  private initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMappingExposure = 1;
    this.renderer.physicallyCorrectLights = true;
    // const pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    // pmremGenerator.compileEquirectangularShader()
    this.renderer.setClearColor(0xa9a9a9, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // css2dRenderer.domElement should be added to dom element by caller
    this.css2dRenderer = new CSS2DRenderer();
    this.css2dRenderer.setSize(this.width, this.height);

    this.stats = Stats();
  }

  private initCamera() {
    if (!this.scene) {
      return; // have to init scene first
    }
    // to avoid z-fighting issue, do not set near value too small!
    // https://www.cnblogs.com/lst619247/p/9098845.html
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, this.width / this.height, this.settings.camera.near, this.settings.camera.far);
    this.perspectiveCamera.position.set(0, 100, 0);
    this.scene.add(this.perspectiveCamera); // need to init scene before camera
    this.camera = this.perspectiveCamera;
  }

  private initControls(isOrthCamera: boolean = false) {
    if (!this.renderer) {
      return;
    }
    // TODO: support touch device later, see https://github.com/tdushinwa/threejs_touchtest/blob/master/js/TrackballControls.js
    DeviceUtils.printDeviceInfo();

    const camera = isOrthCamera ? this.orthoCamera : this.perspectiveCamera;
    if (!camera) {
      return;
    }
    const controls = new OrbitControls(camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.5;
    controls.enabled = true;
    controls.keyPanSpeed = 10;
    // controls.keys = { LEFT: '65', UP: '87', RIGHT: '68', BOTTOM: '83' } // a, w, d, s
    controls.keys = {
      LEFT: "KeyA", // left arrow
      UP: "Space", // up arrow
      RIGHT: "KeyD", // right arrow
      BOTTOM: "ControlLeft" // down arrow
    };
    controls.listenToKeyEvents(document.body);
    controls.update();
    if (isOrthCamera) {
      this.orthoCameraConrols = controls;
    } else {
      this.perspectiveCameraControls = controls;
    }
    this.controls = controls;
    this.addEvent(controls, "change", this.onControlsChange(this));
    this.addEvent(window, "keydown", this.onKeyDown(this));
  }

  private onControlsChange(viewer: Viewer3D) {
    return () => {
      viewer.enableRender();
    };
  }

  private onKeyDown(viewer: Viewer3D) {
    return (e: KeyboardEvent) => {
      const camera = viewer.camera;
      const controls = viewer.controls;
      if (!camera || !controls) {
        return;
      }
      const sensitivity = this.settings.keyboard.sensitivity || 3;
      const p = new THREE.Vector3(); // camera's position
      camera.getWorldPosition(p);
      const t = controls.target; // target point
      const newTarget = t.clone();
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        // keep camera's position uchanged, rotate to left (q) or right (e) around y-axis
        // thus it changes target(lookAt) point
        const ANGLE = sensitivity; // angle in degree
        let theta = (Math.PI * ANGLE) / 180; // angle in radians
        if (e.code === "ArrowLeft") {
          theta = -theta; // rotate to left
        }
        newTarget.x = ((t.x - p.x) * Math.cos(theta) - (t.z - p.z) * Math.sin(theta)) + p.x;
        newTarget.z = ((t.z - p.z) * Math.cos(theta) + (t.x - p.x) * Math.sin(theta)) + p.z;
        controls.target = newTarget;
        controls.update();
      } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        // keep camera's position uchanged, rotate to left (q) or right (e) around y-axis
        // thus it changes target(lookAt) point's y value
        const ANGLE2 = sensitivity; // angle in degree
        let theta2 = (Math.PI * ANGLE2) / 180; // angle in radians
        const distVec = new THREE.Vector3(t.x - p.x, t.y - p.y, t.z - p.z); // distance vector from p to t
        const dist = distVec.length();
        const deltaY = (t.y - p.y);
        if (e.code === "ArrowDown") { // z: rotate down
          theta2 = -theta2;
        }
        const angle = Math.asin(deltaY / dist) + theta2;
        if (angle < -Math.PI / 2 || angle > Math.PI / 2) {
          return; // cannot rotate that much
        }
        const newDeltaY = Math.sin(angle) * dist;
        newTarget.y = t.y + (newDeltaY - deltaY);
        controls.target = newTarget;
        controls.update();
      } else if (e.code === "KeyW") { // go forward
        const ALPHA = sensitivity * 0.01;
        const dist = p.distanceTo(t);
        if (dist < camera.near) {
          // If distance is too close, better to move target position forward too, so camera can keep moving forward,
          // rather than stop at the lookAt position. Let's move it to be 'camera.near' away from camera.
          controls.target.lerp(p, -camera.near / dist);
        }
        p.lerp(t, ALPHA);
        camera.position.set(p.x, p.y, p.z);
      } else if (e.code === "KeyS") { // go backward
        const ALPHA = sensitivity * 0.01;
        p.lerp(t, -ALPHA);
        camera.position.set(p.x, p.y, p.z);
      } else if (e.code === "KeyF") {
        // if there is object selected, fly to it. (This is a design by Unreal Engine)
        this.flyToSelectedObject();
      } else if (e.code === "KeyT") { // reset target
        // When a user does rotate(or pan) operation, where is the rotate center(camera's target)?
        // It depends on where is the camera's target as well as where is the camera itself.
        // Assume camera is at p1, user clicked at p2, target is p3, distance between p1 and p2 is d1, distance between p1 and p3 is d2.
        // In order to have a better user experience, we'll move target to p4 without changing camera's direction,
        // where distance between p1 and p4 equals d1.
        const intersections = this.getIntersections();
        if (intersections.length > 0) {
          const firstIntersect = intersections.find(intersect => {
            const object = intersect.object;
            // exclude invisible objects
            // exclude non-mesh objects, ground, outline, etc.
            return object.visible && object instanceof THREE.Mesh;
          });
          if (firstIntersect && firstIntersect.point && this.camera && this.controls) {
            const p1 = this.camera.position;
            const p2 = firstIntersect.point;
            const p3 = this.controls.target;
            const d1 = p1.distanceTo(p2);
            if (d1 > this.camera.near && d1 < this.camera.far) {
              // only take it as valid scenario when d1 is between near and far
              const d2 = p1.distanceTo(p3);
              const p4 = p1.clone().lerp(p3, d1 / d2);
              this.controls.target.set(p4.x, p4.y, p4.z);
              if (this.scene) {
                CommonUtils.displayPointMarker(this.scene, p4, 1000);
              }
            }
          }
        }
      } else if (e.code === "KeyY") {
        // Make camera direction vertical with y-axis.
        // It is useful when a user want to roaming horizontally with key(w/s/a/d) controls
        this.flyTo(p, t.clone().setY(p.y));
      }
      viewer.enableRender();
    };
  }

  /**
   * When 'pointerup' event is triggered, we don't know if it is a dblclick.
   * So, need to wait for 200ms etc. to see if there is another mouse click.
   */
  onPointerUp(viewer: Viewer3D, event: MouseEvent) {
    return () => {
      if (!viewer.mouseDoubleClicked) {
        // only run it when it is not a dblclick event
        viewer.handleMouseClick(event);
        viewer.enableRender();
      }
    };
  }

  private initLights() {
    if (!this.scene) {
      return;
    }
    // TODO: move light settings into project settings panel
    // Maybe we can automatically calculate light direction, intensity, etc. according to models' materials
    const color = 0xffffff;
    const highIntensity = 0.3;
    const dl = new THREE.DirectionalLight(color, highIntensity);
    dl.position.set(-2, 2, 4);
    this.directionalLight = dl;
    this.ambientLight = new THREE.AmbientLight(0x303030);
    this.hemisphereLight = new THREE.HemisphereLight(color, 0xdddddd, 3);
    this.hemisphereLight.position.set(0, 300, 0);

    this.scene.add(dl);
    this.scene.add(this.ambientLight);
    this.scene.add(this.hemisphereLight);
  }

  /**
   * Initialize mouse/pointer events
   */
  private initPointerEvents() {
    if (!this.renderer || !this.camera || !this.controls) {
      return;
    }
    // add mouse 'click' event, but do not trigger highlight for mouse drag event
    // mouseup/mousedown/mousemove event is prevented by OrbitControls, let's use pointerup/pointerdown/pointermove
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      this.mouseMoved = false;
      this.enableRender();
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      this.mouseMoved = true;
      // should enable render when measuring
      if (this.measure && !this.measure.isCompleted) {
        this.enableRender();
      }
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (!this.mouseMoved && !this.mouseDoubleClicked) {
        // do not run immediately, because it can be a double click
        setTimeout(this.onPointerUp(this, e), 200);
      }
      if (this.mouseDoubleClicked) {
        setTimeout(() => { this.mouseDoubleClicked = false }, 200);
      }
    });
    this.renderer.domElement.addEventListener("dblclick", (e) => {
      this.mouseDoubleClicked = true;
      if (!this.mouseMoved && (!this.measure || this.measure.isCompleted)) {
        this.handleMouseClick(e);
        this.flyToSelectedObject();
        this.enableRender();
      }
    });
    this.raycaster = new Raycaster();
  }

  private initDatGui() {
    this.datGui = new DatGuiHelper(this);
    this.datGui.close(); // collapse it by default
  }

  private initPostmate() {
    if (this.postmate.isEmbedded) {
      this.postmate.addEventListener(MessageId.setObjectsBoxClipper, (messageData: object) => {
        const value = (messageData as BooleanMessageData).value;
        value ? this.enableSection("ObjectsBoxSection") : this.disableSection();
      });
      this.postmate.addEventListener(MessageId.setObjectsPlaneClipper, (messageData: object) => {
        const value = (messageData as BooleanMessageData).value;
        value ? this.enableSection("PlaneSection") : this.disableSection();
      });
    }
  }

  private initOthers() {
    if (!this.scene || !this.renderer || !this.camera) {
      return;
    }

    // Read some settings from Dat.Gui. While in future,
    // these default settings should be defined by project settings.
    const ctrl = this.datGui && this.datGui.controls;
    if (ctrl) {
      // some settings are read from datGui, so it requires to initialize datGui first
      if (ctrl.showGroundGrid) {
        this.groundGrid = GroundUtils.createGroundGrid();
        this.scene.add(this.groundGrid);
      }
      if (ctrl.showGrassGround) {
        (async() => {
          this.grassGround = await GroundUtils.createGrassGround();
          this.scene && this.scene.add(this.grassGround);
          this.enableRender();
        })();
      }

      ctrl.webcam && this.enableWebCam();
      // the order of passes matters, outline pass should be the last one
      this.composerEnabled = ctrl.composerEnabled;
      if (this.composerEnabled) {
        this.enableComposer(true);
        this.enableRenderPass(ctrl.renderPassEnabled);
        this.enableFxaaPass(ctrl.fxaaEnabled);
        this.enableSaoPass(ctrl.saoEnabled);
        this.enableSsaoPass(ctrl.ssaoEnabled);
        this.enableOutlinePass(ctrl.outlineEnabled);
        this.enableSsaaPass(ctrl.ssaaEnabled);
        this.enableBloomPass(ctrl.bloomEnabled);
        this.enableUnrealBloomPass(ctrl.unrealBloomEnabled);
      }
    }

    console.log(`[Viewer] WebGL: ${DeviceUtils.getWebGlRendererInfo(this.renderer.domElement)}`);
    // erase the black outline when viewer is focused
    this.renderer.domElement.style.outlineWidth = "0";
  }

  sycnCameraPosition(src: THREE.PerspectiveCamera | THREE.OrthographicCamera, dest: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    const p = src.position;
    dest.position.set(p.x, p.y, p.z);

    if (this.scene) {
      const t = this.scene.position; // src.target
      dest.lookAt(t);
    }
  }

  sycnControls(src: OrbitControls, dest: OrbitControls, center: THREE.Vector3) {
    const c = center;
    const t = src.target;
    if (dest.center) {
      dest.center.set(c.x, c.y, c.z);
    } else {
      dest.center = c.clone();
    }
    dest.target.set(t.x, t.y, t.z);
    dest.update();
  }

  setToOrthographicCamera(isOrthCamera: boolean = false) {
    if (!this.scene || !this.controls) {
      return;
    }
    const pc = this.perspectiveCamera;
    const pcc = this.perspectiveCameraControls;
    let oc = this.orthoCamera;
    let occ = this.orthoCameraConrols;
    if (isOrthCamera) {
      if (!oc) {
        oc = new THREE.OrthographicCamera(-this.width / 2, this.width / 2, this.height / 2, -this.height / 2, this.settings.camera.near, this.settings.camera.far);
        oc.position.set(0, 100, 0);
        oc.zoom = 10; // it seems 10 works better, but don't know how to set a better one!
        oc.updateProjectionMatrix();
        this.scene && this.scene.add(oc); // need to init scene before camera
        this.orthoCamera = oc;
      }
      if (!occ) {
        this.initControls(true);
        occ = this.orthoCameraConrols;
      }
      if (pc) {
        this.sycnCameraPosition(pc, oc);
        oc.zoom = 10;
        oc.updateProjectionMatrix();
      }
      if (pcc && occ) {
        this.sycnControls(pcc, occ, oc.position);
      }
      this.camera = oc;
      this.controls = occ;
    } else {
      if (pc && oc) {
        this.sycnCameraPosition(oc, pc);
      }
      if (pcc && occ && pc) {
        this.sycnControls(occ, pcc, pc.position);
      }
      this.camera = pc;
      this.controls = pcc;
    }

    this.resize(); // trigger camera to update properly
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.tween && TWEEN.update();
    this.webcam && this.webcam.animate();
    // do not update controls when tween is working, otherwise there is error
    this.controls && !this.tween && this.controls.update();

    if (this.renderEnabled && this.scene && this.camera) {
      this.renderer && this.renderer.render(this.scene, this.camera);
      this.css2dRenderer && this.css2dRenderer.render(this.scene, this.camera);
    }
    if (this.composerRenderEnabled && this.composer && this.composerEnabled) {
      this.composer.render();
      this.composerRenderEnabled = false;
    }
    this.frustrumCullingByModelBBox();
    this.stats && this.stats.update();
  }

  /**
   * This is a method called in animate() in order to optimize rendering speed.
   * The idea is to hide any model out of view frustrum.
   */
  frustrumCullingByModelBBox() {
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    this.isFrustumInsectChecking = true;
    if (this.camera) {
      projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);
      Object.values(this.loadedModels).forEach((obj: {uuid: string, bbox?: THREE.BoxHelper}) => {
        const model = this.scene && this.scene.getObjectByProperty("uuid", obj.uuid);
        const bbox = obj.bbox;
        if (model && bbox && this.scene) {
          // adds userData to model
          // userData: {
          //   _visible: boolean,
          //   userConfigVisibility: boolean
          // }
          // userConfigVisibility is a flag to indicate if model's visibility ever changed by user
          // from BimTree, LayerManager, etc. If ever changed, then frustrumCullingByModelBBox shouldn't
          // work for thus model any more.
          if (typeof model.userData._visible === "undefined") {
            model.userData._visible = true;
            Object.defineProperties(model, {
              visible: {
                set: (val) => {
                  model.userData._visible = val;
                  if (!this.isFrustumInsectChecking) {
                    model.userData.userConfigVisibility = true;
                  }
                },
                get: () => model.userData._visible
              }
            });
          }
          if (typeof model.userData.userConfigVisibility === "undefined") {
            bbox.geometry.computeBoundingBox();
            if (bbox.geometry.boundingBox) {
              model.visible = frustum.intersectsBox(bbox.geometry.boundingBox);
            }
          }
        }
      });
    }
    this.isFrustumInsectChecking = false;
  }

  /**
   * In order to have a better performance, it should only render when necessary.
   * Usually, we should enable render for these cases:
   *  - Anything added to, removed from scene, or objects' position, scale, rotation, opacity, material, etc. changed
   *  - Anything selected/unselected
   *  - Camera changed
   *  - Render area resized
   */
  enableRender = (time: number = 1000) => {
    this.renderEnabled = true;
    if (!this.raf) {
      return;
    }
    this.timeoutSymbol && this.raf.clearTimeout(this.timeoutSymbol);
    this.timeoutSymbol = this.raf.setTimeout(() => {
      this.renderEnabled = false;
      // when main render process is done, enable composer render
      this.composerRenderEnabled = true;
    }, time);
  };

  beforeDestroy() {
    // remove events
    this.events.forEach(e => e.node.removeEventListener(e.type, e.func));
    this.events = [];
    if (this.datGui && this.datGui.gui) {
      this.datGui.beforeDestroy();
      this.datGui = undefined;
    }
    const wc = this.webcamPlane;
    if (this.scene && wc) {
      this.scene.remove(wc);
      wc.geometry.dispose();
      (wc.material as THREE.Material).dispose();
      this.webcamPlane = undefined;
    }
    this.webcam = undefined;
    this.camera = undefined;
    this.composer = undefined;
    this.renderPass = undefined;
    this.effectFxaaPass = undefined;
    this.saoPass = undefined;
    this.ssaoPass = undefined;
    this.outlinePass = undefined;
    /**
     * https://github.com/mrdoob/three.js/releases/tag/r120
     * Scene: Remove dispose()
     * @details https://github.com/mrdoob/three.js/pull/19972
    */
    // this.scene && this.scene.dispose()
    if (this.scene) {
      this.scene.clear();
      this.scene = undefined;
    }
    if (this.renderer) {
      this.renderer.clear();
      this.renderer.dispose();
      this.renderer = undefined;
    }
    this.ambientLight = undefined;
    this.directionalLight = undefined;
    this.hemisphereLight = undefined;
    if (this.controls) {
      this.controls.dispose();
      this.controls = undefined;
    }
    this.stats = undefined;
    this.raycaster = undefined;
    this.selectedObject = undefined;
    if (this.groundGrid) {
      this.groundGrid.geometry.dispose();
      (this.groundGrid.material as THREE.Material).dispose();
      this.groundGrid.clear();
      this.groundGrid = undefined;
    }
    if (this.grassGround) {
      this.grassGround.geometry.dispose();
      (this.grassGround.material as THREE.Material).dispose();
      this.grassGround.clear();
      this.grassGround = undefined;
    }
    if (this.skyOfGradientRamp) {
      this.skyOfGradientRamp.geometry.dispose();
      // TODO: don't know why ShaderMaterial still cannot be released from memory
      (this.skyOfGradientRamp.material as THREE.Material).dispose();
      this.skyOfGradientRamp.clear();
      this.skyOfGradientRamp = undefined;
    }
    this.savedMaterialsForOpacity = undefined;
    this.section = undefined;
    Object.keys(this.loadedModels).forEach(key => {
      delete this.loadedModels[key];
    });
    if (this.raf) {
      this.timeoutSymbol && this.raf.clearTimeout(this.timeoutSymbol);
      this.raf = undefined;
    }
    if (this.postmate.isEmbedded) {
      this.postmate.removeEventListener(MessageId.setObjectsBoxClipper, MessageId.setObjectsPlaneClipper);
    }
  }

  async loadLocalModel(options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const url = options.src;
    const fileName = options.src.toLowerCase();
    if (fileName.endsWith("fbx")) {
      return this.loadFbx(url, options, onProgress, onError);
    } else if (fileName.endsWith("obj")) {
      return this.loadObj(url, options, onProgress, onError);
    } else if (fileName.endsWith("stl")) {
      return this.loadStl(url, options, onProgress, onError);
    } else if (fileName.endsWith("ifc")) {
      return this.loadIfc(url, options, onProgress, onError);
    } else if (fileName.endsWith("shp")) {
      return this.loadShp(url, options, onProgress, onError);
    } else if (fileName.endsWith("dae")) {
      return this.loadDae(url, options, onProgress, onError);
    } else {
      return this.loadGltf(url, options, onProgress, onError);
    }
  }

  async loadModel(options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const url = options.src.toLowerCase();
    if (url.endsWith("fbx")) {
      return this.loadFbx(url, options, onProgress, onError);
    } else if (url.endsWith("obj")) {
      return this.loadObj(url, options, onProgress, onError);
    } else if (url.endsWith("stl")) {
      return this.loadStl(url, options, onProgress, onError);
    } else if (url.endsWith("ifc")) {
      return this.loadIfc(url, options, onProgress, onError);
    } else if (url.endsWith("shp")) {
      return this.loadShp(url, options, onProgress, onError);
    } else if (url.endsWith("dae")) {
      return this.loadDae(url, options, onProgress, onError);
    } else {
      return this.loadGltf(url, options, onProgress, onError);
    }
  }

  async loadGltf(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const loader = this.getGltfLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      if (url.indexOf("#") !== -1) {
        console.warn(`[Viewer3D] '#' is not allowed in filename ${url}`);
      }
      loader.load(url.replace(/#/g, encodeURIComponent("#")), gltf => {
        const object = gltf.scene;
        this.applyOptionsAndAddToScene(url, object, options);
        resolve(object);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadFbx(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const loader = new FBXLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, object => {
        this.applyOptionsAndAddToScene(url, object, options);
        resolve(object);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadObj(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const loader = new OBJLoader();
    const mtlLoader = new MTLLoader();
    // for now, assume mtl is under the same folder (TODO: refine it later)
    const mtlUrl = url.replace(".obj", ".mtl");
    return new Promise<THREE.Object3D>((resolve, reject) => {
      mtlLoader.load(mtlUrl, material => {
        material.preload();
        loader.setMaterials(material);
        loader.load(url, object => {
          this.applyOptionsAndAddToScene(url, object, options);
          resolve(object);
        },
        onProgress,
        (event) => {
          onError && onError(event);
          reject(event);
        });
      });
    });
  }

  async loadStl(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    const loader = new STLLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, (geometry: THREE.BufferGeometry) => {
        const object = new THREE.Mesh(geometry);
        if (options.src) {
          object.name = options.src;
        } else {
          const i = url.lastIndexOf("/");
          if (i !== -1) {
            object.name = url.substr(i + 1);
          }
        }
        this.applyOptionsAndAddToScene(url, object, options);
        resolve(object);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadIfc(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    if (!this.scene) {
      throw new Error("Failed to load!");
    }
    const loader = new IFCLoader();
    /**
     * web-ifc.wasm
     * wasm is required in order to load ifc file, we'll need to copy:
     * three/examples/jsm/loaders/ifc/web-ifc.wasm to /public/three/js/libs/ifc/
     *
     * TODO: support highlight/select/hide individual object, rather than the entire object:
     * https://github.com/mrdoob/three.js/pull/21905
     */
    const mgr = (loader as any).ifcManager;
    if (mgr && typeof mgr.setWasmPath === "function") {
      mgr.setWasmPath("../three/js/libs/ifc/");
    }
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, (ifcModel: any) => {
        this.applyOptionsAndAddToScene(url, ifcModel.mesh, options);
        resolve(ifcModel.mesh);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadShp(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    if (!this.scene) {
      throw new Error("Failed to load!");
    }
    const loader = new SHPLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, object => {
        this.applyOptionsAndAddToScene(url, object, options);
        resolve(object);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadDae(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    if (!this.scene) {
      throw new Error("Failed to load!");
    }
    const loader = new ColladaLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, (collada: Collada) => {
        if (!collada) {
          const event = new ErrorEvent("");
          onError && onError(event);
          reject(event);
        } else {
          const object = collada.scene;
          this.applyOptionsAndAddToScene(url, object, options);
          resolve(object);
        }
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  async loadPly(url: string, options: Model, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Promise<THREE.Object3D> {
    if (!this.scene) {
      throw new Error("Failed to load!");
    }
    const loader = new PLYLoader();
    return new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(url, (geometry: THREE.BufferGeometry) => {
        const object = new THREE.Mesh(geometry);
        if (options.src) {
          object.name = options.src;
        } else {
          const i = url.lastIndexOf("/");
          if (i !== -1) {
            object.name = url.substr(i + 1);
          }
        }
        this.applyOptionsAndAddToScene(url, object, options);
        resolve(object);
      },
      onProgress,
      (event) => {
        onError && onError(event);
        reject(event);
      });
    });
  }

  /**
   * Applies options and add object to scene.
   */
  private applyOptionsAndAddToScene(url: string, object: THREE.Object3D, options: Model) {
    const position = options.position || [0, 0, 0];
    const rotation = options.rotation || [0, 0, 0];
    const scale = options.scale || [1, 1, 1];
    const instantiate = options.instantiate;
    const merge = options.merge;
    object.position.set(position[0], position[1], position[2]);
    object.rotation.set(rotation[0] * Math.PI / 180.0, rotation[1] * Math.PI / 180.0, rotation[2] * Math.PI / 180.0);
    object.scale.set(scale[0], scale[1], scale[2]);
    if (instantiate) {
      // load and display first, then do instantiation
      setTimeout(() => {
        this.instantiate(object);
        // If we do instantiate, better to goToHomeView() and regenSky() after instantiate is done,
        // otherwise, the bounding box could be wrong.
        // This makes loading take longer time, since we add to scene after instantiate!
        setTimeout(() => {
          if (merge) {
            this.merge(object);
          }
          this.addLoadedModelToScene(object, options);
        }, 0);
      }, 0);
    } else if (merge) {
      setTimeout(() => {
        this.merge(object);
        // If we do instantiate, better to goToHomeView() and regenSky() after instantiate is done,
        // otherwise, the bounding box could be wrong.
        // This makes loading take longer time, since we add to scene after instantiate!
        setTimeout(() => this.addLoadedModelToScene(object, options), 0);
      }, 0);
    } else {
      this.addLoadedModelToScene(object, options);
    }
  }

  private getGltfLoader() {
    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(decoderPath);
      this.gltfLoader.setDRACOLoader(dracoLoader);
      /** TODO: 版本升级导致 setDDSLoader 不存在，需用 KHR_texture_basisu 替换 */
      // this.gltfLoader.setDDSLoader(new DDSLoader())
    }
    return this.gltfLoader;
  }

  /**
   * Add newly added object to scene.
   * Also, usually(but not always) we should regenerate sky and go to home view
   * @param object
   */
  private addLoadedModelToScene(object: THREE.Object3D, options: Model) {
    if (!this.scene) {
      return;
    }
    // Set object.matrixAutoUpdate = matrixAutoUpdate for static or rarely moving objects and manually call
    // object.updateMatrix() whenever their position/rotation/quaternion/scale are updated.
    object.matrixAutoUpdate = matrixAutoUpdate;
    object.updateMatrix();
    object.traverse(obj => {
      if (!matrixAutoUpdate && obj.matrixAutoUpdate) {
        obj.matrixAutoUpdate = matrixAutoUpdate;
        obj.updateMatrix();
      }
      // Below is a workaround to make object transparent when there is opacity < 1 and transprent is false for some data.
      // It really should be fixed in data side, but to be compatible with these data, let's do it for now!
      const tryMakeTransparent = (mat: THREE.Material) => {
        if (mat.opacity < 1.0 && !mat.transparent) {
          mat.transparent = true;
        }
      };
      if (obj instanceof THREE.Mesh) {
        if (obj.material instanceof THREE.Material) {
          tryMakeTransparent(obj.material);
        } else if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => {
            tryMakeTransparent(mat);
          });
        }
      }
    });
    this.scene.add(object);
    const bbox = new THREE.BoxHelper(object);
    bbox.visible = false;
    bbox.matrixAutoUpdate = matrixAutoUpdate;
    if (bbox.material) { // prevent ray from hitting the BoxHelper
      // @ts-ignore
      bbox.material = undefined;
      bbox.userData.selectable = false;
    }

    this.loadedModels[options.src] = {
      uuid: object.uuid,
      bbox
    };
    const modelUuids = Object.values(this.loadedModels).map(obj => obj.uuid);
    const isFirstModel = (!modelUuids || modelUuids.length <= 1);
    if (isFirstModel) {
      const ctrl = this.datGui && this.datGui.controls;
      this.regenSkyOfGradientRamp();
      if (ctrl && ctrl.showGroundGrid) {
        this.regenGroundGrid();
      }
      this.goToHomeView(); // only go to home view once, when the first model loaded
    }
    this.scene.add(bbox);

    if (options.edges) {
      ObjectUtils.addOutlines(object);
    }

    this.enableRender();
  }

  /**
   * We won't set a opacity directly, because that way will lose model's original opacity value
   * @param isAdd is add or remove the opacity we added
   * @param opacity
   */
  public addOrRemoveObjectOpacity(isAdd = true, opacity = 0.3) {
    // store informations into materials, so we can revert them
    if (!this.savedMaterialsForOpacity) {
      this.savedMaterialsForOpacity = [];
    }
    if (!this.scene) {
      return;
    }
    const scene = this.scene;
    const materialInfoList:MaterialInfo[] = [];
    Object.keys(this.loadedModels).forEach(key => {
      const obj = this.loadedModels[key];
      if (isAdd) {
        if (this.savedMaterialsForOpacity!.length > 0) {
          ObjectUtils.revertObjectOpacityByUuid(scene, obj.uuid, this.savedMaterialsForOpacity!);
        }
        const list = ObjectUtils.setObjectOpacityByUuid(scene, obj.uuid, opacity);
        materialInfoList.push(...list);
      } else {
        ObjectUtils.revertObjectOpacityByUuid(scene, obj.uuid, this.savedMaterialsForOpacity!);
      }
    });
    if (isAdd) {
      this.savedMaterialsForOpacity = materialInfoList;
    } else {
      this.savedMaterialsForOpacity = [];
    }
    this.enableRender();
  }

  // resize render area
  // if no width or height passed in, use window.innerWidth/window.innerHeight instead
  public resize(width?: number, height?: number) {
    // handle window resize event
    const camera = this.camera;
    if (camera) {
      this.width = width || window.innerWidth;
      this.height = height || window.innerHeight;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = this.width / this.height;
      } else if (camera instanceof THREE.OrthographicCamera) {
        camera.left = -this.width / 2;
        camera.right = this.width / 2;
        camera.top = this.height / 2;
        camera.bottom = -this.height / 2;
      }
      camera.updateProjectionMatrix();
      if (this.renderer) {
        this.renderer.setSize(this.width, this.height);
      }
      if (this.css2dRenderer) {
        this.css2dRenderer.setSize(this.width, this.height);
      }
      if (this.composer) {
        this.composer.setSize(this.width, this.height);
      }
      if (this.effectFxaaPass) {
        // eslint-disable-next-line
        this.effectFxaaPass.uniforms["resolution"].value.set(1 / this.width, 1 / this.height)
      }
    }
    this.enableRender();
  }

  private clonedHighlightMaterials(mesh: THREE.Mesh, options: {
    depthTest?: boolean,
    highlightColor?: THREE.Color,
    opacity?: number
  } = {}): THREE.Material | THREE.Material[] | undefined {
    if (!mesh || !mesh.material) {
      return undefined;
    }
    const mat = mesh.material;
    if (Array.isArray(mat) && mat.length > 0) {
      const newMaterials: Material[] = [];
      mat.forEach(m => {
        newMaterials.push(this.clonedHighlightMaterial(m, options));
      });
      return newMaterials;
    } else if (mat instanceof THREE.Material) {
      return this.clonedHighlightMaterial(mat, options);
    } else {
      console.warn(`Invalid material: ${mat}`);
    }
    return undefined;
  }

  private clonedHighlightMaterial(material: Material, options: {
    depthTest?: boolean,
    highlightColor?: THREE.Color,
    opacity?: number
  } = {}) {
    const { depthTest = undefined, highlightColor = new THREE.Color(0x08e8de), opacity = 0.7 } = options;
    // change highlight color here is we don't like it
    // the original mererial may be used by many objects, we cannot change the original one, thus need to clone
    const mat = material.clone();
    if (mat instanceof MeshStandardMaterial) {
      mat.emissive.set(highlightColor);
      mat.color.set(highlightColor);
    } else if (mat instanceof MeshPhongMaterial) {
      mat.emissive.set(highlightColor);
      mat.color.set(highlightColor);
    } else if (mat instanceof MeshBasicMaterial) {
      mat.color.set(highlightColor);
    } else if (mat instanceof LineBasicMaterial) {
      mat.color.set(highlightColor);
    } else if (mat instanceof MeshLambertMaterial) {
      mat.color.set(highlightColor);
    } else {
      console.error("Unsupported Material: " + (typeof mat).toString());
    }
    // it looks better to be transparent (no matter if it is originally transparent)
    mat.opacity = opacity;
    mat.transparent = true; // make transparent and so it can visually block other object
    if (depthTest !== undefined) {
      // set depthTest to false so that user can always see it
      mat.depthTest = false;
      // make sure to be visible for both side
      mat.side = THREE.DoubleSide;
    }
    return mat;
  }

  /**
   * Gets intersections by given mouse location.
   * If no MouseEvent is passed in, use (0, 0) as the raycaster's origin.
   */
  private getIntersections(event?: MouseEvent): THREE.Intersection[] {
    if (!this.raycaster || !this.camera || !this.scene) {
      return [];
    }

    let x = 0;
    let y = 0;
    if (event) {
      x = (event.clientX / this.width) * 2 - 1; // convert screen coord to normalrized device coord (NDC), [-1, 1]
      y = -(event.clientY / this.height) * 2 + 1;
    }
    const coords = new THREE.Vector2(x, y);
    this.raycaster.setFromCamera(coords, this.camera);
    const objects: THREE.Object3D[] = [];
    Object.values(this.loadedModels).forEach(obj => {
      const object = this.scene && this.scene.getObjectByProperty("uuid", obj.uuid);
      if (object && object.visible) {
        objects.push(object);
      }
    });
    return this.raycaster.intersectObjects(objects, true) || [];
  }

  /**
   * Handles mouse click event
   */
  private handleMouseClick(event: MouseEvent) {
    // when measure is enabled, disable highlight/select feature
    if (this.measure && !this.measure.isCompleted) {
      return;
    }
    const intersections = this.getIntersections(event);
    const firstIntersect = intersections.find(intersect => {
      const object = intersect.object;
      // exclude invisible objects
      // exclude non-selectable non-mesh objects, ground, outline, etc. It's kind of complex, but gonna be wired if user can select another object behand a mesh.
      return object.visible && (object.userData.selectable !== false || object instanceof THREE.Mesh);
    });
    let object = (firstIntersect && firstIntersect.object) || undefined;
    let instanceId;
    if (object) {
      if (object.userData.selectable === false) {
        // If the first intersect object is not selectable (sky, ground, merged mesh, etc.),
        // don't select anything (don't select the second object, that seems wired).
        console.log(`[Viewer] object(type: ${object.type}, name: ${object.name}) not selectable!`);
        object = undefined;
      } else if (object instanceof THREE.InstancedMesh) {
        instanceId = (firstIntersect as THREE.Intersection).instanceId;
        if (this.selectedObject && this.selectedObject.uuid === object.uuid && this.selectedObject.userData.instanceId === instanceId) {
          // if the same InstancedMesh is selected and with the same instanceId, then deselect it
          object = undefined;
        }
      } else if (this.selectedObject && this.selectedObject.uuid === object.uuid) {
        // if one object is selected twice, deselect it
        object = undefined;
      }
    }
    object ? this.selectObject(object, instanceId) : this.clearSelection();
  }

  /**
   * Select or unselect an object.
   * It doesn't support selecting more than one objects.
   * It doesn't support selecting a parent object which doesn't have material itself.
   * In order to support de-select, we'll need to store some information, we do this via userData:
   * For InstancedMesh, there are two cases:
   * 1) One Mesh in InstancedMesh is selected
   * it adds following to selected object: userData {
   *   instanceId: number,
   *   originalMatrix: THREE.Matrix4,
   *   clonedMesh: THREE.Mesh
   * }
   * 2) The whole InstancedMesh is selected. This case is no different from a normal Mesh is selected, so:
   * For Mesh, it adds: userData {
   *   originalMaterial: THREE.Material
   * }
   * @param object
   * @param instanceId pass in instanceId if an InstancedMesh is selected
   * @param depthTest set to false if caller want to make sure user can see it. When an object is
   * selected by user manually, we don't need to make sure user can see it. While if selection is
   * made by program, we parbably need to make sure user can see it, in other words, the selected
   * object won't be blocked by other objects.
   */
  public selectObject(object?: THREE.Object3D, instanceId?: number, depthTest: boolean | undefined = undefined) {
    // revert last selected object's material if any
    if (this.selectedObject) {
      const userData = this.selectedObject.userData;
      if (userData.instanceId != null && userData.originalMatrix && userData.clonedMesh) {
        this.scene && this.scene.remove(userData.clonedMesh); // clear the cloned mesh
        const im = this.selectedObject as THREE.InstancedMesh;
        im.setMatrixAt(userData.instanceId, userData.originalMatrix); // revert the matrix
        im.instanceMatrix.needsUpdate = true;
        im.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
        delete userData.instanceId;
        delete userData.originalMatrix;

        // if the cloned object is selected, then just de-select it and return
        if (object === userData.clonedMesh) {
          userData.clonedMesh.geometry.dispose();
          delete userData.clonedMesh;
          this.selectedObject = undefined;
          if (this.outlinePass) {
            this.outlinePass.selectedObjects = [];
          }
          return;
        }
        userData.clonedMesh.geometry.dispose();
        delete userData.clonedMesh;
      } else if (userData.originalMaterial) {
        if (this.selectedObject.material) {
          // manually dispose it according to https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
          const material = this.selectedObject.material;
          if (Array.isArray(material)) {
            material.forEach(m => m.dispose());
          } else if (material instanceof THREE.Material) {
            material.dispose();
          }
        }
        this.selectedObject.material = userData.originalMaterial;
        delete userData.originalMaterial; // clean up
      }
      this.selectedObject = undefined;
      if (this.outlinePass) {
        this.outlinePass.selectedObjects = [];
      }
    }
    if (!this.scene || !object) {
      return;
    }
    if (object instanceof THREE.InstancedMesh && instanceId != null) {
      const im = object as THREE.InstancedMesh;
      const originalMatrix = new THREE.Matrix4();
      const hideMatrix = new THREE.Matrix4();
      hideMatrix.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); // this matrix hides an object
      im.getMatrixAt(instanceId, originalMatrix);
      this.selectedObject = object;
      if (this.outlinePass) {
        this.outlinePass.selectedObjects = [object];
      }

      // Here is the example to select InstancedMesh, which is to call setColorAt()
      // https://threejs.org/examples/?q=instanc#webgl_instancing_raycast
      // While, it sounds like only support MeshPhongMaterial. So here, we'll clone
      // a mesh with highlighted color to replace the original instance in InstancedMesh
      const clonedMaterial = this.clonedHighlightMaterials(object, { depthTest });
      if (clonedMaterial) {
        // clone a new mesh for the selected instance
        const clonedMesh = new THREE.Mesh(im.geometry.clone(), clonedMaterial);
        clonedMesh.applyMatrix4(object.matrixWorld.multiply(originalMatrix));
        clonedMesh.matrixWorldNeedsUpdate = true;
        clonedMesh.name = "Cloned mesh for highlighting";
        // hide the original mesh by its matrix
        const matrix = originalMatrix.clone();
        matrix.multiplyMatrices(originalMatrix, hideMatrix);
        im.setMatrixAt(instanceId, matrix);
        im.instanceMatrix.needsUpdate = true;
        im.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
        this.selectedObject.userData.instanceId = instanceId; // store some instanceId so highlight can be reverted
        this.selectedObject.userData.originalMatrix = originalMatrix;
        this.selectedObject.userData.clonedMesh = clonedMesh;
        this.scene.add(clonedMesh); // add it to scene temporaly
      }
    } else {
      // save the original material, so we can reverit it back when deselect
      const clonedMaterial = this.clonedHighlightMaterials(object as THREE.Mesh, { depthTest });
      if (clonedMaterial) {
        this.selectedObject = object;
        this.selectedObject.userData.originalMaterial = this.selectedObject.material;
        this.selectedObject.material = clonedMaterial;
        if (this.outlinePass) {
          this.outlinePass.selectedObjects = [object];
        }
      }
    }
    this.enableRender();
  }

  /**
   * Clears the current selection
   */
  public clearSelection() {
    this.selectObject(); // simply select nothing
  }

  /**
   * Make camera fly to objects
   */
  public flyToObjects(objects: THREE.Object3D[]) {
    if (!objects || objects.length === 0 || !this.camera) {
      return;
    }
    const eye = new THREE.Vector3();
    const look = new THREE.Vector3();
    Viewer3DUtils.getCameraPositionByObjects(objects, this.camera, eye, look);
    this.flyTo(eye, look);
  }

  /**
   * Make camera fly to an object
   */
  public flyToObject(object: THREE.Object3D) {
    this.flyToObjects([object]);
  }

  /**
   * Flies to current selected object if any
   */
  public flyToSelectedObject() {
    if (!this.selectedObject) {
      return;
    }
    let obj = this.selectedObject;
    // if part of InstancedMesh is selected, fly to that part rather than fly to the whole InstancedMesh
    if (obj instanceof THREE.InstancedMesh && obj.userData.clonedMesh) {
      obj = obj.userData.clonedMesh;
    }
    this.flyToObject(obj);
  }

  /**
   * Make camera fly to target position with given lookAt position
   * @param position camera's target position
   * @param lookAt camera's new lookAt position
   */
  public flyTo(position: THREE.Vector3, lookAt: THREE.Vector3, onCompleteCallback?: () => void) {
    const camera = this.camera;
    const controls = this.controls;
    if (!camera || !controls) {
      return;
    }
    if (position.equals(lookAt)) {
      console.error("[Viewer3D] camera position and lookAt cannot be the same!");
      return;
    } else if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z) || isNaN(lookAt.x) || isNaN(lookAt.y) || isNaN(lookAt.z)) {
      console.error("[Viewer3D] invalid position or lookAt!");
      return;
    }
    // If distance between position and lookAt is too near or far (according to camera's near/far settings).
    // need to adjust 'position' to fit it.
    const distance = position.distanceTo(lookAt);
    if (distance < camera.near) {
      // the new position is just farer than original position
      position = position.clone().sub(lookAt).normalize().multiplyScalar(camera.near * 1.1);
      console.warn("[Viewer3D] camera could be too close to see the object!");
    } else if (distance > camera.far) {
      // the new position is just closer than original position
      position = position.clone().sub(lookAt).normalize().multiplyScalar(camera.far * 0.9);
      console.warn("[Viewer3D] camera could be too far to see the object!");
    }

    const update = (p?: THREE.Vector3, t?: THREE.Vector3) => {
      t && camera.lookAt(t);
      p && camera.position.set(p.x, p.y, p.z);
      t && controls.target.set(t.x, t.y, t.z);
      controls.update();
      this.enableRender();
    };

    // there are two steps
    // 1) change camera's lookAt point in x miliseconds
    // 2) change camera's position in y miliseconds
    const t = controls.target.clone(); // have to copy one, otherwise TWEEN breaks the passed in object!
    const tween1 = new TWEEN.Tween(t);
    tween1.to(lookAt, 500);
    tween1.easing(TWEEN.Easing.Sinusoidal.InOut);
    tween1.onUpdate(() => {
      update(undefined, t);
    });
    tween1.onComplete(() => {
      const p = camera.position.clone();
      const tween2 = new TWEEN.Tween(p);
      tween2.to(position, 1500);
      tween2.easing(TWEEN.Easing.Sinusoidal.InOut);
      tween2.onUpdate(() => {
        update(p, lookAt);
      });
      tween2.onComplete(() => {
        update(p, lookAt);
        onCompleteCallback && onCompleteCallback();
      });
      this.tween = tween2;
      tween2.start();
    });
    this.tween = tween1;
    tween1.start();
  }

  public goToHomeView() {
    const proj = store.state.activeProject;
    const home = proj && proj.camera;
    const position = home && ProjectManager.arrayToVector3(home.eye);
    const target = home && ProjectManager.arrayToVector3(home.look);
    if (position && target) {
      this.flyTo(position, target);
    } else if (this.scene) {
      // if home.eye not defined in project, then go to 'Front'
      const eye = new THREE.Vector3();
      const look = new THREE.Vector3();
      Viewer3DUtils.getCameraPositionByObjectUuids(this.scene, Object.values(this.loadedModels).map(obj => obj.uuid), Views.Front, eye, look);
      // do not allow camera's target and position is the same point!!
      if (!eye.equals(look)) {
        this.flyTo(eye, look);
      }
    }
  }

  /**
   * Regenerates skybox according to models' location and size
   */
  private regenSkyOfGradientRamp() {
    if (!this.scene) {
      return;
    }
    if (this.skyOfGradientRamp) {
      this.skyOfGradientRamp.geometry.dispose();
      (this.skyOfGradientRamp.material as THREE.Material).dispose();
      this.scene.remove(this.skyOfGradientRamp);
      this.skyOfGradientRamp.clear();
      this.skyOfGradientRamp = undefined;
    }
    const modelUuids = Object.values(this.loadedModels).map(obj => obj.uuid);
    if (modelUuids) {
      const proj = store.state.activeProject;
      const home = proj && proj.camera;
      const position = home && ProjectManager.arrayToVector3(home.eye);
      const target = home && ProjectManager.arrayToVector3(home.look);
      if (position && target) {
        const p1 = position;
        const p2 = target;
        const bbox = new THREE.Box3();
        bbox.expandByPoint(new THREE.Vector3(p1.x, p1.y, p1.z));
        bbox.expandByPoint(new THREE.Vector3(p2.x, p2.y, p2.z));
        this.skyOfGradientRamp = SkyboxUtils.createSkyOfGradientRampByBoundingBox(bbox);
      } else {
        this.skyOfGradientRamp = SkyboxUtils.createSkyOfGradientRampByObjectsInScene(this.scene, modelUuids);
      }
      this.scene.add(this.skyOfGradientRamp);
    }
  }

  /**
   * Regenerates ground grid according to models' location and size
   */
  private regenGroundGrid() {
    if (!this.scene) {
      return;
    }
    if (this.groundGrid) {
      this.groundGrid.geometry.dispose();
      (this.groundGrid.material as THREE.Material).dispose();
      this.scene.remove(this.groundGrid);
    }
    const modelUuids = Object.values(this.loadedModels).map(obj => obj.uuid);
    if (modelUuids) {
      const proj = store.state.activeProject;
      const home = proj && proj.camera;
      const center = home && ProjectManager.arrayToVector3(home.look);
      center && (center.y = 0);
      // TODO: will need to consider ground size according to models' size
      this.groundGrid = GroundUtils.createGroundGrid(undefined, undefined, center);
      this.scene.add(this.groundGrid);
    }
  }

  /**
   * Enables or disable Composer
   */
  public enableComposer(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer) {
      return;
    }

    this.composerEnabled = enable;
    if (enable && !this.composer) {
      this.composer = new EffectComposer(this.renderer);
    }
    this.enableRender();
  }

  /**
   * Enables or disable RenderPass
   */
  public enableRenderPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.renderPass) {
      const pass = new RenderPass(this.scene, this.camera);
      pass.setSize(this.width, this.height);
      this.composer.addPass(pass);
      this.renderPass = pass;
    }
    if (this.renderPass) {
      this.renderPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable FxaaPass
   */
  public enableFxaaPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.effectFxaaPass) {
      const pass = new ShaderPass(FXAAShader);
      // eslint-disable-next-line
      pass.uniforms["resolution"].value.set(1 / this.width, 1 / this.height)
      pass.setSize(this.width, this.height);
      pass.renderToScreen = true;
      this.composer.addPass(pass);
      this.effectFxaaPass = pass;
    }
    if (this.effectFxaaPass) {
      this.effectFxaaPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable SAOPass
   */
  public enableSaoPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.saoPass) {
      const pass = new SAOPass(this.scene, this.camera, false, true, new THREE.Vector2(1 / this.width, 1 / this.height));
      pass.setSize(this.width, this.height);
      // pass.renderToScreen = true
      // pass.resolution.set(1024, 1024)
      pass.params.output = 0;
      pass.params.saoBias = 0.5; // -1 - 1
      pass.params.saoIntensity = 0.00005; // 0 - 1
      pass.params.saoScale = 5; // 0 - 10
      pass.params.saoKernelRadius = 40; // 1 - 100
      pass.params.saoMinResolution = 0; // 0 - 1
      // pass.params.saoBlur = true
      // pass.params.saoBlurRadius = 8 // 0 - 200
      // pass.params.saoBlurStdDev = 4 // 0.5 - 150
      // pass.params.saoBlurDepthCutoff = 0.01 // 0 - 0.1
      this.composer.addPass(pass);
      this.saoPass = pass;
    }
    if (this.saoPass) {
      this.saoPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable SSAOPass
   */
  public enableSsaoPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.ssaoPass) {
      const pass = new SSAOPass(this.scene, this.camera, this.width, this.height);
      pass.kernelRadius = 16;
      pass.minDistance = 0.005; // 0.001 - 0.02
      pass.maxDistance = 0.1; // 0.01 - 0.3
      // pass.output = 0 // 'Default': 0, 'SSAO': 1, 'Blur': 2, 'Beauty': 3, 'Depth': 4, 'Normal': 5
      this.composer.addPass(pass);
      this.ssaoPass = pass;
    }
    if (this.ssaoPass) {
      this.ssaoPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable OutlinePass
   */
  public enableOutlinePass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.outlinePass) {
      const pass = new OutlinePass(new THREE.Vector2(this.width, this.height), this.scene, this.camera);
      pass.edgeStrength = 3;
      pass.edgeGlow = 0;
      pass.edgeThickness = 2;
      pass.pulsePeriod = 0; // 0: don't pulse
      // outlinePass.usePatternTexture =
      pass.visibleEdgeColor.set(0xff0000);
      pass.hiddenEdgeColor.set(0xffa080);
      this.composer.addPass(pass);
      this.outlinePass = pass;
    }
    if (this.outlinePass) {
      this.outlinePass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable SSAARenderPass
   */
  public enableSsaaPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.ssaaRenderPass) {
      const pass = new SSAARenderPass(this.scene, this.camera, 0xffffff, 0);
      this.composer.addPass(pass);
      this.ssaaRenderPass = pass;
    }
    if (this.ssaaRenderPass) {
      this.ssaaRenderPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable BloomPass
   */
  public enableBloomPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.bloomPass) {
      const pass = new BloomPass(
        1, // strength
        25, // kernel size
        4 // sigma ?
      );
      pass.renderToScreen = true; // usually set it to true if it is the last pass
      this.composer.addPass(pass);
      this.bloomPass = pass;
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enables or disable UnrealBloomPass
   */
  public enableUnrealBloomPass(enable: boolean) {
    if (!this.scene || !this.camera || !this.renderer || !this.composer) {
      return;
    }

    if (enable && !this.unrealBloomPass) {
      const pass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1, 0, 0);
      pass.threshold = 0;
      pass.strength = 0.5;
      pass.radius = 0;
      this.composer.addPass(pass);
      this.unrealBloomPass = pass;
    }
    if (this.unrealBloomPass) {
      this.unrealBloomPass.enabled = enable;
    }
    this.enableRender();
  }

  /**
   * Enable section.
   * Currently, it only implemented local(object) box section.
   */
  public enableSection(sectionMode: string = "ObjectsBoxSection") {
    if (!this.scene || !this.camera || !this.renderer || !this.controls) {
      return;
    }
    if (this.section) {
      this.disableSection();
    }
    const modelUuids = Object.values(this.loadedModels).map(obj => obj.uuid);
    if (!modelUuids || modelUuids.length < 1) {
      console.warn("No object to section!");
      return;
    }
    this.renderer.localClippingEnabled = true;
    if (sectionMode === "ObjectsBoxSection") {
      this.section = new ObjectsBoxSection(modelUuids, this.scene, this.camera, this.renderer, this.controls);
      this.section.open();
    } else if (sectionMode === "PlaneSection") {
      this.section = new ObjectsPlaneSection(modelUuids, this.scene, this.camera, this.renderer, this.controls);
      this.section.open();
    }
    this.enableRender();
  }

  public disableSection() {
    if (!this.renderer || !this.section) {
      return;
    }
    // It seems okay to keep localClippingEnabled to be true for ever...
    // this.renderer.localClippingEnabled = false
    this.section.close();
    this.section = undefined;
    this.enableRender();
  }

  public enableMeasure(mode: MeasureMode) {
    if (!this.scene || !this.camera || !this.renderer || !this.controls) {
      return;
    }
    if (this.measure) {
      this.disableMeasure();
    }
    this.measure = new Measure(this.renderer, this.scene, this.camera, this.controls, mode, this.settings);
    this.measure.open();
  }

  public disableMeasure() {
    if (!this.renderer || !this.measure) {
      return;
    }
    if (this.measure) {
      this.measure.close();
    }
    this.measure = undefined;
  }

  public enableWebCam() {
    if (!this.scene) {
      return;
    }

    // for now, this is a demo. Just create a 5x4 plane and put it somewhere
    if (!this.webcam) {
      this.webcam = new WebCam();
    }
    if (!this.webcamPlane) {
      this.webcamPlane = this.webcam.createWebCamPlane();
      this.webcamPlane.position.set(10, 2, 0);
    }
    this.scene.add(this.webcamPlane);
  }

  public disableWebCam() {
    if (!this.scene) {
      return;
    }
    if (this.webcamPlane) {
      this.webcamPlane.geometry.dispose();
      (this.webcamPlane.material as THREE.Material).dispose();
      this.scene.remove(this.webcamPlane);
    }
  }

  /**
   * Instatiates leaf nodes of given object.
   * If objects' geometry and material are the same, they can be instanced.
   * @param object
   */
  private instantiate(object: THREE.Object3D) {
    new InstantiateHelper(object).instantiate();
  }

  /**
   * Merges leaf nodes of given object.
   * If objects' materials are the same, they can be merged.
   * @param object
   */
  private merge(object: THREE.Object3D) {
    new MergeHelper(object).merge();
  }

  /**
   * Watches specified property of 'this' class
   */
  watch = (propertyName: string, callback: any) => {
    if (propertyName in this) {
      let old = this[propertyName];
      Object.defineProperty(this, propertyName, {
        set: function(val) {
          const o = old;
          old = val;
          callback(val, o, this);
        },
        get: function() {
          return old;
        }
      });
    }
  };

  /**
   * Calls addEventListener of a node.
   * This makes sure to removeEventListener properly
   * @param node window, dom element, etc.
   * @param type 'change', 'keydown', etc.
   * @param func event callback
   */
  private addEvent(node: any, type: string, func: any) {
    node.addEventListener(type, func);
    this.events.push({ node, type, func });
  }

  /**
   * Updates project settings
   */
  public updateProjectSettings(settings: SettingsType) {
    this.settings = settings;

    const updateCameraSettings = (c: THREE.PerspectiveCamera | THREE.OrthographicCamera | undefined, cs: CameraSettings) => {
      if (c && cs) {
        c.near = cs.near;
        c.far = cs.far;
        c.updateProjectionMatrix();
      }
    };
    updateCameraSettings(this.perspectiveCamera, this.settings.camera);
    updateCameraSettings(this.orthoCamera, this.settings.camera);
    this.enableRender(10);
  }
}
