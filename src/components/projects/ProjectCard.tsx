import { Component, Vue, Prop, Emit } from "vue-property-decorator";
import { Project } from "@/core/ProjectManager";
import { VNode } from "vue/types/umd";
import styles from "./ProjectCard.module.scss";

export interface ProjectCardProps {
  project: Project;
  click?: (project: Project) => void;
}

@Component
export default class ProjectCard extends Vue {
  @Prop({ required: true }) project!: ProjectCardProps["project"];
  @Prop({ required: false }) click?: ProjectCardProps["click"];

  @Emit()
  delete(e: MouseEvent) { e.stopPropagation() }

  readonly defaultThumbnail = "images/default-thumbnail.jpg";

  mounted() {
    const div = this.$refs.thumbnail as HTMLDivElement;
    if (this.project.thumbnail) {
      div.style.backgroundImage = `url(${this.project.thumbnail})`;
    }
  }

  openProject(project: Project) {
    return (event: MouseEvent) => {
      console.log(`[PC] Routing to project: ${project.name}, id: ${project.id}`);
      this.$router.push(`/projects/${project.id}`);
    };
  }

  protected render(): VNode {
    return (
      <div ref="projectCard" class={styles.projectCard} onClick={/* this.click || */ this.openProject(this.project)}>
        <div class={styles.card}>
          <div ref="thumbnail" class={styles.thumbnail}>
          </div>
          <div class={styles.infos}>
            <div class={styles.info}>{`${this.project.name}`}</div>
          </div>
        </div>
      </div>
    );
  }
}
