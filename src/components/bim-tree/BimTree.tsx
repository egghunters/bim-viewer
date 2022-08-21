import * as THREE from "three";
import { BooleanMessageData, MessageId } from "../../core/postmate/Message";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { ExportUtils } from "../../core/utils/ExportUtils";
import { TreeData } from "element-ui/types/tree";
import { MaterialInfo, ObjectUtils } from "../../core/utils/ObjectUtils";
import { MessageBox, Tree } from "element-ui";
import { MessageBoxData } from "element-ui/types/message-box";
import { ObjectsBoxSection } from "../../core/section/ObjectsBoxSection";
import { ObjectsPlaneSection } from "../../core/section/ObjectsPlaneSection";
import { PostmateManager } from "../../core/postmate/PostmateManager";
import { VNode } from "vue/types/umd";
import BasePanel from "@/components/base-panel/BasePanel";
import ElTree from "@/lib/element-ui/tree/src/tree.vue";
import Exploder from "../../core/exploder/Exploder";
import InstantiateHelper from "../../core/helpers/InstantiateHelper";
import MergeHelper from "../../core/helpers/MergeHelper";
import store, { Types } from "@/store";
import styles from "./BimTree.module.scss";
import Viewer3D from "../../core/Viewer3D";
import Viewer3DUtils from "../../core/utils/Viewer3DUtils";

export enum Command {
  ZoomTo = "zoomTo",
  Transparent = "transparent",
  Wireframe = "wireframe",
  Outline = "outline",
  Material = "material",
  SectionBox = "sectionBox",
  SectionPlane = "sectionPlane",
  CustomizedSectionPlane = "customizedSectionPlane",
  Explode = "explode",
  Floor = "floor",
  Instantiate = "instantiate",
  Merge = "merge",
  ExportToGltf = "exportToGltf",
  ExportToGlb = "exportToGlb",
  ExportToObj = "exportToObj",
  ExportToDraco = "exportToDraco",
  ExportToThreeJsJson = "exportToThreeJsJson"
}

export interface BimTreeProps {
  viewer: Viewer3D | undefined;
}

/**
 * BIM Tree class
 */
@Component
export default class BimTree extends Vue {
  @Prop({ required: true }) viewer!: BimTreeProps["viewer"];

  private readonly checkMark = "√ ";
  private treeData?: TreeData[] = [];
  private filterText = "";
  private visible?: boolean = false;
  private treeHeight = 300;
  private readonly postmate = PostmateManager.instance();
  // need to save dropdown menu's state for each model, so we can update it accordingly
  private dropdownMenuState: { [uuid: string]: {
    components: { [command: string]: any }, // store the components, so we can update its status
    materialInfoList?: MaterialInfo[], // used for transparent mode
    isWireframeMode?: boolean,
    showOutline?: boolean,
    objectsBoxSection?: ObjectsBoxSection,
    objectsPlaneSection?: ObjectsPlaneSection,
    customizedPlaneSection?: ObjectsPlaneSection,
    exploder?: Exploder,
    filterByFloorInfo?: { includeObjectUuids: string[], materialInfoList: MaterialInfo[] },
    isInstantiated?: boolean,
    isMerged?: boolean
  } } = {};

  mounted() {
    this.setBimTreeVisibility(!!this.visible);

    this.postmate.addEventListener(MessageId.setBimTree, (messageData: object) => {
      const visible = (messageData as BooleanMessageData).value;
      this.setBimTreeVisibility(visible);
    });
    this.postmate.addEventListener(MessageId.highlightRandomNode, () => {
      if (!this.treeData || this.treeData.length < 1) {
        return;
      }
      let i = Math.floor(Math.random() * this.treeData.length);
      let data: TreeData = this.treeData[i];
      if (data.children) {
        i = Math.floor(Math.random() * data.children.length);
        data = data.children[i];
        if (data.children) {
          i = Math.floor(Math.random() * data.children.length);
          data = data.children[i];
        }
      }
      this.handleNodeClick(data);
    });
  }

  @Watch("showBimTree")
  onShowBimTreeChanged(visible: boolean) {
    this.setBimTreeVisibility(visible);
  }

  @Watch("filterText")
  onFilterTextChanged(value: string) {
    const tree = this.$refs.tree as Tree;
    tree.filter(value.toLowerCase()); // convert to lower case here
  }

  filterNode(value: string, data: TreeData) {
    if (!value) {
      return true;
    }
    const label = (data && data.label && data.label.toLowerCase()) || "";
    return label.indexOf(value) !== -1;
  }

  /**
   * Gets visibility of BIM Tree
   */
  get showBimTree() {
    return this.$store.getters.getShowBimTree;
  }

  /**
   * Gets model uuids in the viewer
   */
  private bimModelUuids() {
    if (this.viewer) {
      return Object.values(this.viewer.loadedModels).map(obj => obj.uuid);
    }
    return [];
  }

  public get bimTreeData(): TreeData[] | undefined {
    if (!this.visible) {
      this.treeData = []; // release memory at this time
    } else {
      this.treeData = this.bimModelsToTreeData();
    }
    return this.treeData;
  }

  // The 'checked' status of a tree node reflects to 'visible' of an object. So, TODOs:
  // 1) Need to set 'checked' status according to if an object is visible.
  // 2) When a node is checked/unchecked, store the status, so when next time BimTree is opened, the check status is correct.
  private get defaultCheckedKeys(): string[] {
    if (!this.bimModelUuids) {
      console.warn("[BT] bimModels not defined!");
      return [];
    }
    if (!this.visible) {
      return [];
    }
    let keys: string[] = [];
    if (this.treeData) {
      keys = this.treeData.map(item => item.id);
    }
    return keys;
  }

  private changeTreeHeight() {
    const treeWrapper = this.$refs.treeWrapper;
    if (treeWrapper) {
      this.treeHeight = (treeWrapper as Element).clientHeight - 44;
    }
  }

  private bimModelsToTreeData(bimModelUuids: string[] = []): TreeData[] | undefined {
    if (!this.viewer || !this.viewer.scene) {
      return [];
    }
    let modelUuids = bimModelUuids;
    if (!modelUuids || modelUuids.length === 0) {
      modelUuids = this.bimModelUuids();
    }
    const treeData: TreeData[] = [];
    let counter = 1;
    this.viewer.scene.traverse((object: any) => {
      if (modelUuids.find(uuid => uuid === object.uuid)) {
        const treeItem = this.objectToTreeData(object);
        if (treeData && treeItem) {
          if (treeData.find(item => item.label === treeItem.label)) {
            // duplicated label found, should fix it to workaround console error
            treeItem.label += ("-" + counter++);
          }
          treeData.push(treeItem);
        }
      }
    });
    return treeData;
  }

  /**
   * Convert a node to TreeData. This is a recursive method.
   * @param object
   * @param maxDepth
   */
  private objectToTreeData(object: THREE.Object3D, maxDepth = 5): TreeData | undefined {
    if (!object || maxDepth < 0) {
      return;
    }
    // ignore outline
    if (object.userData.isOutline === true) {
      return;
    }
    const treeItem: TreeData = {};
    treeItem.id = object.uuid || ""; // use model.uuid for TreeData.id
    treeItem.label = this.getTreeLabelForObject(object);
    if (object.children) {
      let counter = 1; // node's label may be the same, need to fix it to make el-tree happy
      // children may not have foreach method, wired!
      for (let i = 0; i < object.children.length; ++i) {
        if (!treeItem.children) {
          treeItem.children = [];
        }
        const childTreeItem = this.objectToTreeData(object.children[i], maxDepth - 1); // recursive call
        if (childTreeItem) {
          if (treeItem.children.find(c => c.label === childTreeItem.label)) {
            // duplicated label found, should fix it to workaround console error
            childTreeItem.label += `-${counter++}`;
          }
          treeItem.children.push(childTreeItem);
        }
      }
    } else {
      treeItem.isLeaf = true; // it should have a better performance to explicitly set isLeaf to true
    }
    return treeItem;
  }

  /**
   * When a tree item is clicked,  handleCheckChange could be triggered more than once.
   * Need to set render-after-expand={ false }
   */
  private handleCheckChange(data: TreeData, checked: boolean, indeterminate: boolean) {
    if (!data || !data.id || !this.viewer || !this.viewer.scene) {
      return;
    }

    const obj = this.getObjectByUuid(data.id);
    if (obj) {
      if (checked) {
        // when checked, also must set parent to visible!
        obj.visible = true;
        obj.traverseAncestors(o => { o.visible = true });
      } else {
        // when unchecked, only handle leaf nodes
        if (!obj.children || obj.children.length <= 0) {
          obj.visible = false;
        }
      }
      // 针对虚拟滚动列表 覆盖未渲染节点
      if (data.children && data.children.length) {
        // 子节点取消勾选触发的父节点状态改变时，不必覆盖全部节点
        if (!checked && indeterminate) {
          return;
        }
        if (obj.children && obj.children.length) {
          this.setObjLeavesVisible(obj.children, checked);
        }
      }
      obj.visible = checked;
      this.viewer.enableRender();
    }
  }

  private setObjLeavesVisible(objects: THREE.Object3D[], visible: boolean) {
    for (const obj of objects) {
      if (obj.children && obj.children.length) {
        this.setObjLeavesVisible(obj.children, visible);
      }
      obj.visible = visible;
    }
  }

  private handleNodeClick(data: TreeData, node?: any, component?: any) {
    if (!data || !data.id || !this.viewer || !this.viewer.scene || !this.viewer.camera) {
      return;
    }
    const obj = this.viewer.scene.getObjectByProperty("uuid", data.id);
    if (obj) {
      const eye = new THREE.Vector3();
      const look = new THREE.Vector3();
      Viewer3DUtils.getCameraPositionByObjects([obj], this.viewer.camera, eye, look);
      this.viewer.flyTo(eye, look);
      Viewer3DUtils.twinkle(obj);
      // in this case set depthTest to false to make sure user can see it
      this.viewer.selectObject(obj, undefined, false);
    }
  }

  private close() {
    // this.$emit('close')
    this.setBimTreeVisibility(false);
  }

  private setBimTreeVisibility(visible: boolean) {
    this.visible = visible;
    store.commit(Types.MUTATION_SHOW_BIM_TREE, visible); // inform datGui to update
  }

  /**
   * Gets object(Mesh, Object3D, etc.) name
   * @param node
   */
  private getTreeLabelForObject(object: THREE.Object3D): string {
    // object name is usually uuid, which is not human-readable
    // let's try to read from userData if there is!
    let name = object.name;
    if (object.userData && object.userData.gltfExtensions) {
      const ext = object.userData.gltfExtensions;
      if (ext.elementId && ext.elementId.Value) {
        name = ext.elementId.Value;
      }
      if (ext.level && ext.level.Value) {
        name = `${name ? name + "-" : ""}${ext.level.Value}`;
      }
    }
    if (!name) {
      name = "";
    }
    return `${name} [${object.type}]`;
  }

  private startScroll(e: any) {
    const wrapper = e.target;
    const label = e.target.querySelector(".custom-label");
    label.offsetWidth > wrapper.offsetWidth && label.classList.add("auto-scroll");
  }

  private stopScroll(e: any) {
    const wrapper = e.target;
    const label = e.target.querySelector(".custom-label");
    label.offsetWidth > wrapper.offsetWidth && label.classList.remove("auto-scroll");
  }

  public beforeDestroy() {
    Object.keys(this.dropdownMenuState).forEach(key => {
      const state = this.dropdownMenuState[key];
      if (state.components) {
        Object.keys(state.components).forEach(command => {
          state.components[command] = undefined;
        });
      }
      state.materialInfoList = [];
      if (state.objectsBoxSection && state.objectsBoxSection.isOpen) {
        state.objectsBoxSection.close();
        state.objectsBoxSection = undefined;
      }
      if (state.objectsPlaneSection && state.objectsPlaneSection.isOpen) {
        state.objectsPlaneSection.close();
        state.objectsPlaneSection = undefined;
      }
      state.exploder = undefined;
    });
    this.treeData = undefined;
    this.postmate.removeEventListener(MessageId.setBimTree, MessageId.highlightRandomNode);
    this.close();
  }

  /**
   * Gets status by uuid. It makes sure to return non-null object.
   */
  getState(uuid: string) {
    this.dropdownMenuState[uuid] = this.dropdownMenuState[uuid] || { uuid: { component: {} } };
    const state = this.dropdownMenuState[uuid];
    if (state.showOutline === undefined) {
      const object = this.getObjectByUuid(uuid);
      if (object) {
        state.showOutline = ObjectUtils.hasOutline(object);
      }
    }
    return state;
  }

  handleDropdownCommand(uuid: string) {
    return (command: string, component?: any) => {
      const state = this.getState(uuid);
      if (!state.components) {
        state.components = {};
      }
      if (!state.components[command]) {
        state.components[command] = component;
      }
      if (command === Command.ZoomTo) {
        this.zoomTo(uuid);
      } else if (command === Command.Transparent) {
        this.transparent(uuid, component);
      } else if (command === Command.Wireframe) {
        this.wireframe(uuid, component);
      } else if (command === Command.Outline) {
        this.outline(uuid, component);
      } else if (command === Command.Material) {
        this.material(uuid, component);
      } else if (command === Command.SectionBox) {
        this.section(uuid, component);
      } else if (command === Command.SectionPlane) {
        this.sectionPlane(uuid, component);
      } else if (command === Command.CustomizedSectionPlane) {
        this.customizedSectionPlane(uuid, component);
      } else if (command === Command.Explode) {
        this.explode(uuid, component);
      } else if (command === Command.Floor) {
        this.floor(uuid, component);
      } else if (command === Command.Instantiate) {
        this.instantiate(uuid, component);
      } else if (command === Command.Merge) {
        this.merge(uuid, component);
      } else if (command === Command.ExportToGltf) {
        this.exportToGltf(uuid);
      } else if (command === Command.ExportToGlb) {
        this.exportToGlb(uuid);
      } else if (command === Command.ExportToObj) {
        this.exportToObj(uuid);
      } else if (command === Command.ExportToDraco) {
        this.exportToDraco(uuid);
      } else if (command === Command.ExportToThreeJsJson) {
        this.exportToThreeJsJson(uuid);
      } else {
        console.warn(`Unknown command: ${command}`);
      }
    };
  }

  /**
   * Runs a contextual command for given object
   */
  runCommand(uuid: string, command: string) {
    const state = this.getState(uuid);
    if (state && state.components && state.components[command]) {
      const component = state.components[command];
      component.handleClick(); // mimic click event
    } else if (command === Command.Outline) {
      // some commands like outline, is not initialized with a components. In other words,
      // the model already has outline without clicking from dropdown.
      const object = this.getObjectByUuid(uuid);
      object && ObjectUtils.setOutlinesVisibility(object, false);
    }
  }

  /**
   * Runs contextual commands for given object
   */
  runCommands(uuid: string, commands: string[]) {
    commands.forEach(command => this.runCommand(uuid, command));
  }

  /**
   * Zooms to object
   */
  zoomTo(uuid: string) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.camera) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const eye = new THREE.Vector3();
      const look = new THREE.Vector3();
      Viewer3DUtils.getCameraPositionByObjects([obj], this.viewer.camera, eye, look);
      this.viewer.flyTo(eye, look);
      Viewer3DUtils.twinkle(obj);
    }
  }

  /**
   * Makes object transparent
   */
  transparent(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene) {
      return;
    }
    const state = this.getState(uuid);
    const opacity = 0.3;
    if (state.materialInfoList) {
      ObjectUtils.revertObjectOpacityByUuid(this.viewer.scene, uuid, state.materialInfoList);
      state.materialInfoList = undefined;
      this.removeCheckMark(component);
    } else {
      state.materialInfoList = ObjectUtils.setObjectOpacityByUuid(this.viewer.scene, uuid, opacity);
      this.addCheckMark(component);
    }
    this.viewer.enableRender();
  }

  /**
   * Displies object's wireframe
   */
  wireframe(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene) {
      return;
    }
    // wireframe can be affected by selected object, so de-select any object if there is
    this.viewer.clearSelection();

    const state = this.getState(uuid);
    // cancel any other command that conflict with this one
    const commands = [];
    state.materialInfoList && commands.push(Command.Transparent);
    state.objectsBoxSection && commands.push(Command.SectionBox);
    state.objectsPlaneSection && commands.push(Command.SectionPlane);
    state.showOutline && commands.push(Command.Outline);
    if (commands.length > 0) {
      console.log(`[BT] Cancelling conflicted commands: ${commands}`);
      this.runCommands(uuid, commands);
    }

    if (state.isWireframeMode) {
      ObjectUtils.revertWireframeModeByUuid(this.viewer.scene, uuid);
      state.isWireframeMode = undefined;
      this.removeCheckMark(component);
    } else {
      ObjectUtils.setWireframeModeByUuid(this.viewer.scene, uuid);
      state.isWireframeMode = true;
      this.addCheckMark(component);
    }
    this.viewer.enableRender();
  }

  /**
   * Displies object's outline
   */
  outline(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene) {
      return;
    }
    const object = this.getObjectByUuid(uuid);
    if (!object) {
      return;
    }
    // wireframe can be affected by selected object, so de-select any object if there is
    this.viewer.clearSelection();

    const state = this.getState(uuid);
    // cancel any other command that conflict with this one
    const commands = [];
    state.exploder && commands.push(Command.Explode);
    state.isWireframeMode && commands.push(Command.Wireframe);
    if (commands.length > 0) {
      console.log(`[BT] Cancelling conflicted commands: ${commands}`);
      this.runCommands(uuid, commands);
    }

    if (state.showOutline) {
      ObjectUtils.setOutlinesVisibility(object, false);
      state.showOutline = false;
      this.removeCheckMark(component);
    } else {
      if (!ObjectUtils.hasOutline(object)) {
        ObjectUtils.addOutlines(object);
      } else {
        ObjectUtils.setOutlinesVisibility(object, true);
      }
      state.showOutline = true;
      this.addCheckMark(component);
    }
    this.viewer.enableRender();
  }

  /**
   * Shows object's material panel
   */
  material(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene) {
      return;
    }
    // de-select any object if there is
    this.viewer.clearSelection();

    const state = this.getState(uuid);
    // cancel any other command that conflict with this one
    const commands = [];
    state.materialInfoList && commands.push(Command.Transparent);
    state.objectsBoxSection && commands.push(Command.SectionBox);
    state.objectsPlaneSection && commands.push(Command.SectionPlane);
    if (commands.length > 0) {
      console.log(`[BT] Cancelling conflicted commands: ${commands}`);
      this.runCommands(uuid, commands);
    }

    store.commit(Types.MUTATION_OBJECT_UUID_FOR_MATERIAL_MANAGER, uuid);
  }

  /**
   * Box section
   */
  section(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.camera || !this.viewer.renderer || !this.viewer.controls) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.objectsPlaneSection && commands.push(Command.SectionPlane);
      state.customizedPlaneSection && commands.push(Command.CustomizedSectionPlane);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }

      if (state.objectsBoxSection) {
        // It seems okay to keep localClippingEnabled to be true for ever...
        // this.viewer.renderer.localClippingEnabled = false
        state.objectsBoxSection.close();
        state.objectsBoxSection = undefined;
        this.removeCheckMark(component);
      } else {
        this.viewer.renderer.localClippingEnabled = true;
        state.objectsBoxSection = new ObjectsBoxSection([uuid], this.viewer.scene, this.viewer.camera, this.viewer.renderer, this.viewer.controls);
        state.objectsBoxSection.open();
        this.addCheckMark(component);
      }
      this.viewer.enableRender();
    }
  }

  /**
   * Plane section
   */
  sectionPlane(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.camera || !this.viewer.renderer || !this.viewer.controls) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.objectsBoxSection && commands.push(Command.SectionBox);
      state.customizedPlaneSection && commands.push(Command.CustomizedSectionPlane);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }

      if (state.objectsPlaneSection) {
        // It seems okay to keep localClippingEnabled to be true for ever...
        // this.viewer.renderer.localClippingEnabled = false
        state.objectsPlaneSection.close();
        state.objectsPlaneSection = undefined;
        this.removeCheckMark(component);
      } else {
        this.viewer.renderer.localClippingEnabled = true;
        state.objectsPlaneSection = new ObjectsPlaneSection([uuid], this.viewer.scene, this.viewer.camera, this.viewer.renderer, this.viewer.controls);
        state.objectsPlaneSection.open();
        this.addCheckMark(component);
      }
      this.viewer.enableRender();
    }
  }

  /**
   * Customized section plane
   */
  customizedSectionPlane(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.camera || !this.viewer.renderer || !this.viewer.controls) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.objectsBoxSection && commands.push(Command.SectionBox);
      state.objectsPlaneSection && commands.push(Command.SectionPlane);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }

      if (state.customizedPlaneSection) {
        state.customizedPlaneSection.close();
        state.customizedPlaneSection = undefined;
        this.removeCheckMark(component);
      } else {
        // TODO: For now, simply let user to input numbers. In future, should allow user to edit the plan in the scene
        this.viewer.renderer.localClippingEnabled = true;
        const scene = this.viewer.scene;
        const camera = this.viewer.camera;
        const renderer = this.viewer.renderer;
        const controls = this.viewer.controls;
        const format = "Input rotation angle of section plane, recommended value: [-45°, 45°]";
        MessageBox.prompt(format.replace("axis", "X")).then((data: MessageBoxData) => {
          const x = Number((data as any).value);
          if (isNaN(x)) {
            console.log("Invalid input!");
            return;
          }
          MessageBox.prompt(format.replace("axis", "Y")).then((data: MessageBoxData) => {
            const y = Number((data as any).value);
            if (isNaN(y)) {
              console.log("Invalid input!");
              return;
            }
            MessageBox.prompt(format.replace("axis", "Z")).then((data: MessageBoxData) => {
              const z = Number((data as any).value);
              if (isNaN(z)) {
                console.log("Invalid input!");
                return;
              }
              state.customizedPlaneSection = new ObjectsPlaneSection([uuid], scene, camera, renderer, controls);
              state.customizedPlaneSection.open();
              const matrixX = new THREE.Matrix4().makeRotationX(Math.PI / 180 * x);
              const matrixY = new THREE.Matrix4().makeRotationY(Math.PI / 180 * y);
              const matrixZ = new THREE.Matrix4().makeRotationZ(Math.PI / 180 * z);
              const matrix = matrixX.multiply(matrixY).multiply(matrixZ);
              state.customizedPlaneSection.setMatrix(matrix);
              this.addCheckMark(component);
            });
          });
        });
      }
      this.viewer.enableRender();
    }
  }

  /**
   * explodes object
   */
  explode(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.renderer) {
      return;
    }
    let obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.showOutline && commands.push(Command.Outline);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }
      if (state.exploder) {
        ObjectUtils.unexplodeObject(state.exploder);
        state.exploder = undefined;
        this.removeCheckMark(component);
      } else {
        // if object has just one child, then explode doesn't mean anything. In this case, try its child level.
        if (obj.children.length === 1) {
          obj = obj.children[0];
        }
        state.exploder = ObjectUtils.explodeObject(this.viewer.scene, obj);
        this.addCheckMark(component);
      }
      this.viewer.enableRender();
    }
  }

  /**
   * Filter by floor
   */
  floor(uuid: string, component?: any) {
    if (!uuid || !this.viewer || !this.viewer.scene || !this.viewer.renderer) {
      return;
    }
    // TODO: implement a panel for user to set visible floors for this object.
    // What's more, we can create a panel to set floors for all models.
    const floors = ObjectUtils.distinctFloors(this.viewer.scene, [uuid]);
    if (floors.length === 0) {
      MessageBox.alert("Failed to match floor info from components(name, userDate). Please make sure there are floor info(e.g. '2F')", "Warning");
      return;
    }
    const state = this.getState(uuid);
    if (state.filterByFloorInfo) {
      // if it is filtering by floor, we clear it
      const info = state.filterByFloorInfo;
      const mil = (info && info.materialInfoList) || undefined;
      const uuids = (info && info.includeObjectUuids) || undefined;
      ObjectUtils.revertObjectOpacityByUuid(this.viewer.scene, uuid, mil, uuids);
      // clear filter by floor
      // ObjectUtils.revertVisibleForFloorsByUuid(this.viewer.scene, uuid)
      state.filterByFloorInfo = undefined;
      this.removeCheckMark(component);
      this.viewer.enableRender();
      return;
    }
    MessageBox.prompt(`The model contains these floors: ${floors}, please input one or more floors, split with comma `, "Specify floors").then((data: MessageBoxData) => {
      const val = (data as any).value as string;
      if (this.viewer && this.viewer.scene) {
        if (val) {
          // split input with ',', '，' or white space
          const floors = val.split(/[\s,，]+/).map(v => Number(v)); // conver to number
          // make sure objects for expected floor are visible, in case they are invisible by other operations...
          // ObjectUtils.setVisibleForFloors(this.viewer.scene, uuid, floors, false)
          // get un matched objects, then set opacity
          const unmatchUuids: string[] = [];
          ObjectUtils.traverseObjectByFloors(this.viewer.scene, uuid, floors, undefined, (object: THREE.Object3D) => {
            unmatchUuids.push(object.uuid);
          });
          const materialInfo = ObjectUtils.setObjectOpacityByUuid(this.viewer.scene, uuid, 0.1, unmatchUuids);
          if (!state.filterByFloorInfo) {
            this.addCheckMark(component);
          }
          state.filterByFloorInfo = { includeObjectUuids: unmatchUuids, materialInfoList: materialInfo };
          this.viewer.enableRender();
        }
      }
    });
  }

  /**
   * Instantiates objects
   */
  instantiate(uuid: string, component?: any) {
    if (!this.viewer) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.materialInfoList && commands.push(Command.Transparent);
      state.showOutline && commands.push(Command.Outline);
      state.objectsBoxSection && commands.push(Command.SectionBox);
      state.customizedPlaneSection && commands.push(Command.CustomizedSectionPlane);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }

      if (!state.isInstantiated) {
        // instantiate can be affected by selected object, so de-select any object if there is
        this.viewer.clearSelection();

        // outline affects instantiate/merge operation, remove outlines first before instantiate/merge.
        // we can add outlines back after instantiate/merge if necessary
        ObjectUtils.removeOutlines(obj);
        new InstantiateHelper(obj).instantiate();
        if (state.showOutline) {
          ObjectUtils.addOutlines(obj);
        }
        state.isInstantiated = true;
        this.addCheckMark(component);
        // TODO: since objects changed, need to retreive BIM Tree for this object. For now, we can close then reopen BIM Tree
      }
      this.viewer.enableRender();
    }
  }

  /**
   * Merges objects
   */
  merge(uuid: string, component?: any) {
    if (!this.viewer) {
      return;
    }
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      const state = this.getState(uuid);
      // cancel any other command that conflict with this one
      const commands = [];
      state.objectsBoxSection && commands.push(Command.Transparent);
      if (commands.length > 0) {
        console.log(`[BT] Cancelling conflicted commands: ${commands}`);
        this.runCommands(uuid, commands);
      }

      if (!state.isMerged) {
        // merge can be affected by selected object, so de-select any object if there is
        this.viewer.clearSelection();

        // outline affects instantiate/merge operation, remove outlines first before instantiate/merge.
        // we can add outlines back after instantiate/merge if necessary
        ObjectUtils.removeOutlines(obj);
        new MergeHelper(obj).merge();
        if (state.showOutline) {
          ObjectUtils.addOutlines(obj);
        }
        state.isMerged = true;
        this.addCheckMark(component);
        // TODO: since objects changed, need to retreive BIM Tree for this object. For now, we can close then reopen BIM Tree
      }
      this.viewer.enableRender();
    }
  }

  /**
   * Exports to glTF
   */
  exportToGltf(uuid: string) {
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      ExportUtils.exportToGltf(obj, obj.name || obj.uuid);
    }
  }

  /**
   * Exports to glb
   */
  exportToGlb(uuid: string) {
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      ExportUtils.exportToGlb(obj, obj.name || obj.uuid);
    }
  }

  /**
   * Exports to obj
   */
  exportToObj(uuid: string) {
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      ExportUtils.exportToObj(obj, obj.name || obj.uuid);
    }
  }

  /**
   * Exports to draco
   */
  exportToDraco(uuid: string) {
    const obj = this.getObjectByUuid(uuid);
    if (obj instanceof THREE.Mesh) {
      ExportUtils.exportToDraco(obj, obj.name || obj.uuid);
    }
  }

  /**
   * Exports to threejs json
   */
  exportToThreeJsJson(uuid: string) {
    const obj = this.getObjectByUuid(uuid);
    if (obj) {
      ExportUtils.exportToThreeJsJson(obj, obj.name);
    }
  }

  private getObjectByUuid(uuid: string) {
    if (uuid && this.viewer && this.viewer.scene) {
      return this.viewer.scene.getObjectByProperty("uuid", uuid);
    }
    return undefined;
  }

  private addCheckMark(component: any) {
    component.$el.innerText = `${this.checkMark}${component.$el.innerText}`;
  }

  private removeCheckMark(component: any) {
    let str: string = component.$el.innerText;
    str = str.replace(`${this.checkMark}`, "");
    component.$el.innerText = str;
  }

  private renderContent(h: any, { component, node, data, store }: any) {
    if (!data || !data.id || !this.viewer || !this.viewer.scene) {
      return;
    }
    const uuid = data.id;
    const obj = this.getObjectByUuid(uuid);
    const isRootNode = obj && (!obj.parent || obj.parent === this.viewer.scene);
    const isMesh = obj instanceof THREE.Mesh;
    const state = this.getState(uuid);
    const isTransparent = !!state.materialInfoList;
    const isWireframeMode = !!state.isWireframeMode;
    const showOutline = !!state.showOutline;
    const isSection = !!state.objectsBoxSection;
    const isSectionByPanel = !!state.objectsPlaneSection;
    const isCustomizedSectionPlane = !!state.customizedPlaneSection;
    const isExploded = !!state.exploder;
    const isInstantiated = !!state.isInstantiated;
    const isMerged = !!state.isMerged;
    const floors = ObjectUtils.distinctFloors(this.viewer.scene, [uuid]);

    return (<div class="custom-content">
      <div onMouseenter={ this.startScroll } onMouseleave={ this.stopScroll } class="custom-label-wrapper">
        <span class="custom-label">{ node.label }</span>
      </div>
      {isRootNode && // only disply dropdown menu for root node
      <el-dropdown size="mini" class="obj-dropdown" placement="right-start" trigger="click" onCommand={ this.handleDropdownCommand(data.id) }>
        <span onClick={ (event: MouseEvent) => event.stopPropagation() }>
          <i class="el-icon-more"></i>
        </span>
        <el-dropdown-menu slot="dropdown" class="dropdown-menu">
          <el-dropdown-item command={ Command.ZoomTo }>Zoom to extent</el-dropdown-item>
          <el-dropdown-item command={ Command.Transparent }>{ isTransparent && `${this.checkMark}` }Transparent</el-dropdown-item>
          <el-dropdown-item command={ Command.Wireframe }>{ isWireframeMode && `${this.checkMark}` }Wireframe</el-dropdown-item>
          <el-dropdown-item command={ Command.Outline }>{ showOutline && `${this.checkMark}` }Outline</el-dropdown-item>
          <el-dropdown-item command={ Command.Material }>Material manager</el-dropdown-item>
          <el-dropdown-item command={ Command.SectionBox }>{ isSection && `${this.checkMark}` }Section box</el-dropdown-item>
          <el-dropdown-item command={ Command.SectionPlane }>{ isSectionByPanel && `${this.checkMark}` }Section plane</el-dropdown-item>
          {/* Hide functions that doesn't work well in some case! */}
          {/* <el-dropdown-item command={ Command.CustomizedSectionPlane }>{ isCustomizedSectionPlane && `${this.checkMark}` }User defined section plane</el-dropdown-item>
          <el-dropdown-item command={ Command.Explode }>{ isExploded && `${this.checkMark}` }Explode</el-dropdown-item>
          <el-dropdown-item command={ Command.Floor }>View by floor</el-dropdown-item>
          <el-dropdown-item command={ Command.Instantiate } title="Create one InstancedMesh for all Meshes have the same Geometry and Material">{ isInstantiated && `${this.checkMark}` }Instantiate gemometries</el-dropdown-item>
          <el-dropdown-item command={ Command.Merge } title="Merge geometries that has the same Material and Geometry to one">{ isMerged && `${this.checkMark}` }Merge geometries</el-dropdown-item>
          <el-dropdown-item icon="el-icon-download" command={ Command.ExportToGltf }>Export to GLTF</el-dropdown-item>
          <el-dropdown-item icon="el-icon-download" command={ Command.ExportToGlb }>Export to GLB</el-dropdown-item>
          <el-dropdown-item icon="el-icon-download" command={ Command.ExportToObj }>Export to OBJ</el-dropdown-item>
          <el-dropdown-item icon="el-icon-download" command={ Command.ExportToDraco } v-show={ isMesh }>Export to DRACO</el-dropdown-item>
          <el-dropdown-item icon="el-icon-download" command={ Command.ExportToThreeJsJson }>Export to ThreeJS JSON</el-dropdown-item> */}
        </el-dropdown-menu>
      </el-dropdown>
      }
    </div>);
  }

  protected render(): VNode {
    const title = "BIM Tree";
    const scopedSlots = {
      header: () => title,
      content: () => {
        return <div class="tree-wrapper" ref="treeWrapper">
          <el-input placeholder="your input..." v-model={ this.filterText } class="input-with-select" size="mini" prefix-icon="el-icon-search" clearable></el-input>
          {/* @ts-ignore */}
          <ElTree
            node-key="id"
            ref="tree"
            height={this.treeHeight}
            data={ this.bimTreeData }
            default-checked-keys= { this.defaultCheckedKeys }
            show-checkbox
            render-after-expand={ false }
            on-node-click={ this.handleNodeClick }
            render-content={this.renderContent}
            on-check-change={ this.handleCheckChange }
            filter-node-method={ this.filterNode }>
          </ElTree>
        </div>;
      }
    };
    return (
      <BasePanel
        ref="bimTreePanel"
        class={ styles.bimTree }
        v-show={this.visible}
        onClose={this.close}
        onResize={this.changeTreeHeight}
        {...{ scopedSlots }}>
      </BasePanel>
    );
  }
}
