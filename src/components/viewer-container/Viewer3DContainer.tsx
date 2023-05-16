import * as THREE from "three";
import { Component, Vue, Prop } from "vue-property-decorator";
import { cloneDeep } from "lodash";
import { Message } from "element-ui";
import { ProjectManager, Project, Model } from "@/core/ProjectManager";
import { Settings as SettingsType, defaultSettings, settingStoreKeyName } from "@/components/projectSettingsPanel/ProjectSettingsDef";
import { Types } from "@/store/index";
import { VNode } from "vue/types/umd";
import BimTree from "@/components/bim-tree/BimTree";
import BottomBar from "@/components/bottom-bar/BottomBar";
import CoordinateAxesViewport from "@/core/axes/CoordinateAxesViewport";
import MaterialManager from "@/components/materials/MaterialManager";
import ProgressBar from "@/components/progress-bar/ProgressBar";
import ProjectSettingsPanel from "@/components/projectSettingsPanel/ProjectSettingsPanel";
import PropertyPanel from "@/components/property/PropertyPanel";
import settingPanelStyle from "@/components/projectSettingsPanel/ProjectSettings.module.scss";
import SnapshotPanel from "../snapshot/SnapshotPanel";
import styles from "./Viewer3DContainer.module.scss";
import Viewer3D from "@/core/Viewer3D";

export interface Viewer3DContainerProps {
  projectId: string;
}

export enum EventStatus {
  FAILED = 0,
  RUNNING = 1,
  SUCCEEDED = 2
}

@Component
export default class Viewer3DContainer extends Vue {
  @Prop({ required: true }) projectId!: Viewer3DContainerProps["projectId"];

  selectedObjId = "";
  viewer?: Viewer3D;
  axesViewport?: CoordinateAxesViewport;
  onLoading = false;
  loadingProgress = 0;
  loadingText = "";
  projectSettings?:SettingsType;
  showProjectSettingPanel = false;

  mounted() {
    this.initProjectSettings();
    const viewerContainer = (this.$refs.viewerContainer) as HTMLDivElement;
    const viewer = new Viewer3D(window.innerWidth, window.innerHeight, this.projectSettings); // full screen
    viewer.animate();
    this.viewer = viewer;
    if (viewer.renderer) {
      viewerContainer.appendChild(viewer.renderer.domElement);
      ProjectManager.getSampleProjects().then(projects => {
        const proj = projects.find((p: Project) => p.id === this.projectId);
        if (proj) {
          this.$store.commit(Types.MUTATION_ACTIVE_PROJECT, proj);
          this.loadSampleProjectModels(viewer, proj);
        } else {
          Message.error(`Failed to find project for projectId: ${this.projectId}`);
        }
      });
    }
    if (viewer.css2dRenderer) {
      viewer.css2dRenderer.domElement.classList.add("css2dRenderer");
      viewerContainer.appendChild(viewer.css2dRenderer.domElement);
    }
    this.initStats(viewer);
    this.initAxesRenderer(viewer);

    // handle window resize event
    window.addEventListener("resize", () => {
      viewer && viewer.resize(window.innerWidth, window.innerHeight);
    }, false);

    viewer.watch("selectedObject", (obj: any) => {
      if (obj?.userData?.gltfExtensions) {
        const extensions = obj?.userData?.gltfExtensions;
        const objId = extensions?.objectId?.Value || extensions?.elementId?.Value;
        this.selectedObjId = objId || "";
      } else if (obj?.uuid) {
        this.selectedObjId = obj.uuid;
      } else {
        this.selectedObjId = "";
      }
    });
  }

  initStats(viewer: Viewer3D) {
    const stats = viewer.stats as any;
    if (stats) {
      stats.setMode(0); // 0: fps, 1: ms
      const statsOutput = (this.$refs.statsOutput) as HTMLDivElement;
      statsOutput.appendChild(stats.domElement);
    }
  }

  initProjectSettings() {
    const key = settingStoreKeyName + "_" + this.projectId;
    const savedSettings: SettingsType = localStorage.getItem(key) && JSON.parse(localStorage.getItem(key) || "");
    const result = cloneDeep(defaultSettings);
    if (savedSettings) {
      Object.assign(result, cloneDeep(savedSettings));
    }
    this.projectSettings = result;
  }

  beforeDestroy() {
    if (this.viewer) {
      this.viewer.beforeDestroy();
      this.viewer = undefined;
    }
    if (this.axesViewport) {
      this.axesViewport.dispose();
      this.axesViewport = undefined;
    }
    this.selectedObjId = "";
    this.loadingText = "";
  }

  initAxesRenderer(viewer: Viewer3D) {
    const axesDiv = (this.$refs.axesRenderer) as HTMLDivElement;
    const cav = new CoordinateAxesViewport(axesDiv.clientWidth, axesDiv.clientHeight);
    if (cav.renderer) {
      axesDiv.appendChild(cav.renderer.domElement);
      cav.setHostRenderer(viewer);
    }
    this.axesViewport = cav;
  }

  loadSampleProjectModels(viewer: Viewer3D, proj: Project) {
    if (!viewer || !proj) {
      console.log("[VC] Failed to load a project!");
      return;
    }
    if (!proj.models || proj.models.length < 1) {
      console.log("[VC] No models to load!");
      return;
    }
    this.onLoading = false;
    this.loadingProgress = 0;
    let counter = 0; // to indicate how many models are loading
    for (let i = 0; i < proj.models.length; ++i) {
      const model = proj.models[i];
      if (model.visible === false) {
        continue; // skip when visible is false
      }
      counter++;
      this.onLoading = true;
      viewer.loadModel(model, (event) => {
        this.loadingText = `${proj.name}(${i + 1}/${proj.models.length})`;
        this.loadingProgress = Math.floor(event.loaded * 100 / event.total);
      }, (event) => {
        Message.error("Failed to load " + model.src + ". " + event.message);
        this.onLoading = (--counter > 0);
      }).then(() => {
        this.onLoading = (--counter > 0);
      });
    }
  }

  getEventStatusIcon(status: number) {
    let icon = "";
    switch (status) {
      case EventStatus.RUNNING:
        icon = "el-icon-loading";
        break;
      case EventStatus.FAILED:
        icon = "el-icon-warning";
        break;
      case EventStatus.SUCCEEDED:
        icon = "el-icon-success";
        break;
      default:
        icon = "el-icon-loading";
        break;
    }
    return icon;
  }

  toggleProjectSettingPanel(val: boolean) {
    this.$store.commit(Types.MUTATION_SHOW_PROJECT_SETTINGS_PANEL, val);
  }

  /**
   * Enables user to upload a model file from local disk.
   * TODO:
   * - Enable user to set the model's position, rotation, scale, etc.
   * - Enable to store the model to server, so user can see it next time open the same project.
   */
  uploadModelFile(viewer?: Viewer3D) {
    return (event: any) => {
      const files = event.target.files;
      if (!files || files.length <= 0) {
        return;
      }
      const file = files[0];
      // const url = URL.createObjectURL(file);
      this.onLoading = true;
      const options: Model = {
        src: file.name,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        instantiate: false,
        merge: false
      };
      viewer && viewer.loadLocalModel(options, (event) => {
        this.loadingText = `Loading ${file.name}`;
        this.loadingProgress = Math.floor(event.loaded * 100 / event.total);
      }, (event) => {
        Message.error("Failed to load " + file.name + ". " + event.message);
        this.onLoading = false;
      }).then(() => {
        this.onLoading = false;
      });
    };
  }

  protected render(): VNode {
    return (
      <div ref="viewerContainer" class={styles.viewerContainer}>
        <div ref="statsOutput" class={styles.statsOutput} />
        <BimTree viewer={ this.viewer } />
        <PropertyPanel scene={ this.viewer?.scene } objId={ this.selectedObjId } class={styles.propertyPanel} />
        <MaterialManager viewer={ this.viewer } />
        <div ref="axesRenderer" id="axesRenderer" class={styles.axesRenderer} />
        <SnapshotPanel canvas={this.viewer?.renderer?.domElement} />
        <BottomBar viewer={ this.viewer } />
        {/* Used to enable user from uploading a local model file to scene. The model won't be saved to server for now */}
        <input type="file" id="uploadModelFile" style="display: none" onChange={ this.uploadModelFile(this.viewer) } />
        {this.onLoading && <ProgressBar text={this.loadingText} progressValue={this.loadingProgress} />}
        <el-dialog
          title="Project settings"
          width="400px"
          class={settingPanelStyle.pSettingDialog}
          visible={this.$store.getters[Types.GETTER_SHOW_PROJECT_SETTINGS_PANEL]}
          destroyOnClose={true}
          on={{ "update:visible": (val: boolean) => { this.toggleProjectSettingPanel(val) } }}>
          <ProjectSettingsPanel projectId={this.projectId} on={{ "update:visible": (val: boolean) => { this.toggleProjectSettingPanel(val) } }} viewer={this.viewer}></ProjectSettingsPanel>
        </el-dialog>
      </div>
    );
  }
}
