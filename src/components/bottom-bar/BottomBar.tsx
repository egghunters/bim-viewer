import * as THREE from "three";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { History, PostmateManager } from "../../core/postmate/PostmateManager";
import { VNode } from "vue/types/umd";
import styles from "./BottomBar.module.scss";
import Viewer3D from "../../core/Viewer3D";

export interface BottomBarProps {
  viewer: Viewer3D;
}

/**
 * Object info of the viewer
 */
interface ObjectInfo {
  components: number,
  points: number,
  faces: number,
  materials: { [id: string]: number } // store material ids and ref count
}

@Component
export default class BottomBar extends Vue {
  @Prop({ required: true }) viewer!: BottomBarProps["viewer"]

  private readonly postmate = PostmateManager.instance()
  private postmateHistories: History[] = []
  private postmateHistoryString = ""

  mounted() {
    // when viewer is assigned, watch ObitControls's 'change' event
    this.$watch("viewer", (viewer: Viewer3D) => {
      if (viewer && viewer.controls) {
        viewer.controls.addEventListener("change", this.updateCameraInfo);
      }
    });

    this.postmateHistories = this.postmate.getHistories();
  }

  updateCameraInfo() {
    if (!this.viewer || !this.viewer.scene || !this.viewer.camera || !this.viewer.controls) {
      return;
    }
    const camera = this.viewer.camera;
    const controls = this.viewer.controls;
    const r = (num: number) => Math.round(num); // round
    const p2t = (p: THREE.Vector3) => `(${r(p.x)}, ${r(p.y)}, ${r(p.z)})`; // point to text
    const p = camera.position;
    const t = controls.target; // target point
    if (p) {
      const span = this.$refs.eye as HTMLSpanElement;
      if (span) {
        span.textContent = `Camera position: ${p2t(p)} | Camera target: ${p2t(t)}`;
      }
    }
  }

  getObjectInfo(object: THREE.Object3D, info: ObjectInfo) {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) {
      return;
    }
    // one InstancedMesh counts as 1 object
    info.components++;
    if (object.geometry) {
      const geom = object.geometry;
      if (geom.index && geom.index.count) {
        info.faces += Math.round(geom.index.count / 3);
      }
      if (geom.attributes.position) {
        const pos = geom.attributes.position;
        if (pos.count && pos.itemSize) {
          info.points += pos.count;
        }
      }
    }

    // log material info
    const updateMaterialInfo = (id: number) => {
      if (info.materials[id]) {
        info.materials[id]++; // material id already exist
      } else {
        info.materials[id] = 0; // material id not exist
      }
    };

    const mat = object.material;
    if (mat instanceof THREE.Material) {
      updateMaterialInfo(mat.id);
    } else if (Array.isArray(mat)) {
      mat.forEach(m => updateMaterialInfo(m.id));
    }
  }

  @Watch("postmateHistories")
  updatePostmateHistoryCount() {
    // this.postmateHistories = this.postmate.getHistories()
    const span = this.$refs.postmateHistoryCount as HTMLSpanElement;
    const count = this.postmateHistories.length;
    span.textContent = `${count}`;

    let str = "";
    let i = 1;
    this.postmateHistories.forEach(h => {
      str += `${i++}. ${h.direction} message '${h.messageId}' at ${this.numToTime(h.time)}\n`;
    });
    this.postmateHistoryString = str;
  }

  updateObjectsInfo() {
    const span = this.$refs.objectsInfo as HTMLSpanElement;
    if (!this.viewer.scene) {
      if (span) {
        span.textContent = "Failed!";
      }
      return;
    }
    span.textContent = "Comupting...";
    // const info: { components: number, index: number, vertices: number, faces: number } = { components: 0, index: 0 }
    const info: ObjectInfo = { components: 0, points: 0, faces: 0, materials: {} };
    const updateTextContent = () => {
      const materialCount = Object.keys(info.materials).length;
      span.textContent = `Components: ${info.components}${info.points ? ", Points: " + info.points : ""}${info.faces ? ", Faces: " + info.faces : ""}${materialCount ? ", Materials: " + materialCount : ""}`;
    };
    // traverse will be called on children of each child. Basically it traverses all the
    // descendants of a any given three js object in Depth First Traversal manner.
    this.viewer.scene.traverse((object) => {
      this.getObjectInfo(object, info);
      updateTextContent();
    });
    updateTextContent();
  }

  private numToTime(time: number) {
    const date = new Date(time);
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  }

  protected render(): VNode {
    return (
      <div class={ styles.bottomBar } ref="bottomBar">
        <div class="main">
          {/* Hide message popover for now */}
          <div class="message" style="display: none">
            <el-popover placement="top" width="550" height="300" trigger="click" class="popover-message">
              <el-input type="textarea" rows="5" v-model={this.postmateHistoryString}></el-input>
              <i class="el-icon-message" slot="reference" title="Click to get messages" onClick={this.updatePostmateHistoryCount}></i>
            </el-popover>
            <span ref='postmateHistoryCount'> 0 </span>
          </div>
          <el-popover placement="top" trigger="click">
            <span ref='objectsInfo'> -- </span>
            <i class="el-icon-info" slot="reference" title="Click to get statistics" onClick={this.updateObjectsInfo}></i>
          </el-popover>
          <span class="separator"> | </span>
          <el-popover placement="top" trigger="click">
            <span ref='eye'>Camera position: --</span>
            <i class="el-icon-view" slot="reference" title="Click to get camera info" onClick={this.updateCameraInfo}></i>
          </el-popover>
          <span class="separator"> | </span>
          <el-popover placement="top" trigger="click">
            <div class="keys">
              <span>W: Move forward</span><br />
              <span>A: Move backward</span><br />
              <span>S: Move left</span><br />
              <span>D: Move right</span><br />
              <span>Ctrl: Move lower</span><br />
              <span>Space: Move higher</span><br />
              <span>↑: Rotate up</span><br />
              <span>←: Rotate to left</span><br />
              <span>↓: Rotate to right</span><br />
              <span>→: Rotate to right</span><br />
            </div>
            <i class="el-icon-more" slot="reference" title="Click to get keyboard tips" onClick={this.updateCameraInfo}></i>
          </el-popover>
        </div>
      </div>
    );
  }
}
