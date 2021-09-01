import { Component, Vue } from "vue-property-decorator";
import { createProject, deleteProject, uploadBimFile } from "@/service/project";
import { Message } from "element-ui";
import { ProjectManager, Project } from "@/core/ProjectManager";
import { VNode } from "vue/types/umd";
import ProjectCard from "../../components/projects/ProjectCard";
import styles from "./Projects.module.scss";
// import UploadForm from "@/components/upload-form/UploadForm";

@Component
export default class Projects extends Vue {
  // define a global static variable, so we only need to get demo projects once
  static sampleProjects: Project[] = []
  sampleProjects: Project[] = []
  onLoading = false
  activateUpdate = false
  customProjects: Project[] = []

  async mounted() {
    if (Projects.sampleProjects.length === 0) {
      this.onLoading = true;
      ProjectManager.getSampleProjects().then((projects: Project[]) => {
        Projects.sampleProjects.push(...projects);
        this.sampleProjects = Projects.sampleProjects;
      }).finally(() => {
        this.onLoading = false;
      });
    } else {
      this.sampleProjects = Projects.sampleProjects;
    }
  }

  createNewProject() {
    // disable from creating a project for now!
    Message.warning("Not implemented yet!");
    // this.activateUpdate = true
  }

  async addNewProject(data: any) {
    const projectId = await this.addProject(data);
    if (projectId && data.uploadFiles.length) {
      this.uploadModel(projectId, data);
    }
    this.activateUpdate = false;
  }

  async addProject(data: any) {
    const createData = new FormData();
    const projectKeys = ["projectName", "projectDescription"];
    projectKeys.forEach(key => {
      createData.append(key, data[key]);
    });
    const res = await createProject(data.projectName, data.projectDescription) as any;
    if (res && res.projectId) {
      const proj = {
        id: res.projectId,
        name: data.projectName,
        models: []
      };
      ProjectManager.addCustomProject(proj);
      this.customProjects = ProjectManager.customProjects;
      return res.projectId;
    }
    return "";
  }

  async uploadModel(projectId: string, data: any) {
    const upData = new FormData();
    data.uploadFiles.forEach((file: File) => {
      upData.append("file", file, file.name);
    });
    upData.append("splitMethod", data.splitMethod);
    await uploadBimFile(projectId, upData);
  }

  async deleteProject(proj: Project) {
    proj.id && await deleteProject(proj.id);
    proj.id && ProjectManager.deleteCustomProject(proj.id);
    this.customProjects = ProjectManager.customProjects;
  }

  protected render(): VNode {
    const sampleProjectCards = this.sampleProjects.map(p => <ProjectCard project={p} class={styles.card} key={p.id}></ProjectCard>);
    return (
      <div ref="projects" class={styles.projects}>
        <el-card class={styles.cardsWrapper}>
          <div slot="header">
            <span class='span'>Sample projects</span>
          </div>
          {sampleProjectCards}
        </el-card>
      </div>
    );
  }
}
