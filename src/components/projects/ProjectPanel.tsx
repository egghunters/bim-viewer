import { Component, Vue } from "vue-property-decorator";
import { VNode } from "vue/types/umd";
import styles from "./projectPanel.module.scss";
import Viewer3DContainer from "../viewer-container/Viewer3DContainer";

export interface ProjectPanelProps {
}

@Component
export default class ProjectPanel extends Vue {
  projectId?: string

  mounted() {
  }

  getProjectId() {
    this.projectId = this.$router.currentRoute.params.projectId;
    if (!this.projectId) {
      console.error("[PP] Invalid projectId!");
      return;
    }
    return this.projectId;
  }

  protected render(): VNode {
    return (
      <div ref="projectPanel" class={styles.projectPanel}>
        <Viewer3DContainer projectId={this.getProjectId()}></Viewer3DContainer>
      </div>
    );
  }
}
