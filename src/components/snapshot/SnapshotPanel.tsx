import { Component, Vue, Prop, Watch } from "vue-property-decorator";
import { VNode } from "vue/types/umd";
import store, { Types } from "@/store/index";
import styles from "./SnapshotPanel.module.scss";

// this requires WebGLRenderer's preserveDrawingBuffer set to true

export interface SnapshotPanelProps {
  canvas: HTMLCanvasElement;
}

@Component
export default class SnapshotPanel extends Vue {
  @Prop({ required: true }) canvas!: SnapshotPanelProps["canvas"];

  private type = "image/png"; // png, jpeg, etc.
  private quality = 0.5; // a value between 0 and 1
  private imageData = "";
  private visible?: boolean = false;

  mounted() {
    this.setPanelVisibility(!!this.visible);
  }

  @Watch("showSnapshotPanel")
  onShowSnapshotPanelChanged(visible: boolean) {
    this.setPanelVisibility(visible);
  }

  get showSnapshotPanel() {
    return this.$store.getters.getShowSnapshotPanel;
  }

  setPanelVisibility(visible: boolean) {
    this.visible = visible;
    const panel = (this.$refs.snapshotPanel) as HTMLDivElement;
    panel.style.display = visible ? "" : "none";

    // when visible, regenerate image
    if (visible) {
      this.regenerateImageData();
    }
  }

  private regenerateImageData() {
    if (this.canvas) {
      this.imageData = this.canvas.toDataURL(this.type, this.quality);
    }
  }

  close() {
    this.setPanelVisibility(false);
    store.commit(Types.MUTATION_SHOW_SNAPSHOT_PANEL, false); // inform other components to update
  }

  protected render(): VNode {
    return (
      <div ref="snapshotPanel" class={styles.snapshotPanel}>
        <div class="popup-title">
          <span class="popup-title-span">Snapshot</span>
          <el-button icon="el-icon-close" class="popup-title-close" onClick={ this.close }></el-button>
        </div>
        <div class="image-container">
          <img id="image" src={this.imageData} class="image" title='Right click to download it'></img>
          <a href={this.imageData} download="snapshot.png" class="download-icon">Download</a>
        </div>
      </div>
    );
  }
}
