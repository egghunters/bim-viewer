import { Component, Vue, Prop, Watch } from "vue-property-decorator";
import { getJson } from "@/service/json";
import { ObjectUtils } from "../../core/utils/ObjectUtils";
import { Project } from "@/core/ProjectManager";
import { VNode } from "vue/types/umd";
import styles from "./PropertyPanel.module.scss";

export interface Property {
  name: string;
  value: any;
}

export interface PropertyPanelProps {
  scene: THREE.Scene;
  objId: string;
}

@Component
export default class PropertyPanel extends Vue {
  @Prop({ required: true }) scene!: PropertyPanelProps["scene"];
  @Prop({ required: true }) objId!: PropertyPanelProps["objId"];

  jsonComponents: any[] = [] // eslint-disable-line
  propData: any[] = [];
  visible?: boolean = false;

  @Watch("objId")
  async updatePropData(id: string) {
    if (!this.visible) {
      return;
    }
    this.propData = this.getObjectAttributes(id);
    const data = this.getPropDataFormJson(id, this.jsonComponents);
    if (data && data.length > 0) {
      this.propData.concat(data);
    }
  }

  @Watch("showPropertyPanel")
  onShowBimTreeChanged(visible: boolean) {
    this.setPanelVisibility(visible);
  }

  get showPropertyPanel() {
    return this.$store.getters.getShowPropertyPanel;
  }

  setPanelVisibility(visible: boolean) {
    this.visible = visible;
  }

  mounted() {
    // do not get component right after mounted, instead, do it later
    // because the activeProject maynot be set at this time!
    // caller need to trigger an 'activeProject' changed event, so PropertyPanel component get
    // the event and update property files
  }

  @Watch("activeProject")
  async onActiveProjectChanged(newProject: Project, oldProject: Project) {
    if (newProject && newProject.id) {
      // TODO
    }
  }

  get activeProject() {
    return this.$store.getters.getActiveProject;
  }

  getObjectAttributes(uuid: string): Property[] {
    if (!uuid) {
      return [];
    }
    const attributes: Property[] = [];
    let object = this.scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      // TODO: we'd better pass in Object3D into PropertyPanel, so that we don't need to find it at all,
      // I've had a try but it doesn't work yet, could do it later.
      object = ObjectUtils.findFirst(this.scene, uuid);
    }
    if (object) {
      object.name && attributes.push({ name: "name", value: object.name });
      attributes.push({ name: "id", value: object.id });
      attributes.push({ name: "uuid", value: object.uuid });
      attributes.push({ name: "type", value: object.constructor.name || object.type });
      const keys = Object.keys(object.userData);
      if (keys.length > 0) {
        let str = "";
        keys.forEach(key => {
          if (str) {
            str += ", ";
          }
          str += `${key}: ${object && object.userData[key]}`;
        });
        attributes.push({ name: "userData", value: str });
      }
    }
    return attributes;
  }

  async setComponents(project: Project) {
    if (project && project.models.length > 0) {
      for (const model of project.models) {
        const propFile = model.propertyFile;
        if (propFile) {
          const json = await getJson(propFile);
          if (json && json.objects) {
            this.jsonComponents.push(...json.objects.components);
          }
        }
      }
    }
  }

  getPropDataFormJson(id: string, json: any[]) {
    if (json.length > 0) {
      const userData = json.find(comp => comp.uuid === id)?.userData;
      if (userData) {
        return Object.keys(userData).map(key => {
          return {
            name: key,
            value: userData[key]
          };
        });
      }
    }
    return [];
  }

  protected render(): VNode {
    return (
      <div class={styles.tableWrapper} v-show={this.visible && this.propData.length}>
        <el-table
          data={this.propData}
          size="mini"
          border
          max-height="200">
          <el-table-column
            prop="name"
            width="100"
            label="Name">
          </el-table-column>
          <el-table-column
            prop="value"
            width="200"
            label="Value">
          </el-table-column>
        </el-table>
      </div>
    );
  }
}
