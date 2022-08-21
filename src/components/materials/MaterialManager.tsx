import * as THREE from "three";
import { Component, Prop, Vue, Watch } from "vue-property-decorator";
import { VNode } from "vue/types/umd";
import BasePanel from "@/components/base-panel/BasePanel";
import store, { Types } from "@/store";
import styles from "./MaterialManager.module.scss";
import Viewer3D from "../../core/Viewer3D";

// TODO:
// - note that if material is changed by other operations, it should refresh this panel,
// - cannot revert the change yet

export interface MaterialManagerProps {
  viewer: Viewer3D | undefined;
}

interface TableRow {
  materialId: number;
  name: string;
  type: string;
  color: string;
  refCount: number;
}

@Component
export default class MaterialManager extends Vue {
  @Prop({ required: true }) viewer!: MaterialManagerProps["viewer"];

  visible?: boolean = false;
  objectUuid: string | null = null;
  materials: THREE.Material[] = [];
  materialData: TableRow[] = [];
  selectedMaterialIndex = -1;

  mounted() {
    this.setPanelVisibility(!!this.visible);

    if (this.visible && this.objectUuid) {
      this.getMaterials();
    }
  }

  @Watch("objectUuidForMaterialManager")
  onObjectUuidForMaterialManagerChanged(objectUuid: string | null) {
    if (!objectUuid) {
      // hide panel
      this.setPanelVisibility(false);
    } else {
      // TODO: if read material is kind of slow, we can improve it by not reading again if uuid unchanged
      this.objectUuid = objectUuid;
      this.setPanelVisibility(true);
    }
  }

  get objectUuidForMaterialManager() {
    return store.getters.getObjectUuidForMaterialManager;
  }

  close() {
    this.setPanelVisibility(false);
    store.commit(Types.MUTATION_OBJECT_UUID_FOR_MATERIAL_MANAGER, null);
  }

  setPanelVisibility(visible: boolean) {
    this.visible = visible;
    if (this.visible && this.objectUuid) {
      this.materials = [];
      this.materialData = [];
      this.getMaterials();
      if (this.selectedMaterialIndex === -1 && this.materials.length > 0) {
        this.selectedMaterialIndex = 0; // select the first one by default
      }
    }
  }

  beforeDestroy() {
    this.setPanelVisibility(false);
    this.materials = [];
    this.materialData = [];
  }

  getMaterials() {
    if (!this.viewer || !this.viewer.scene || !this.objectUuid) {
      return [];
    }

    const obj = this.viewer.scene.getObjectByProperty("uuid", this.objectUuid);
    if (obj) {
      this.getMaterialsInner(obj);
    }
  }

  private getMaterialsInner(object: THREE.Object3D) {
    if (!object) {
      return;
    }
    if (object.children.length > 0) {
      object.children.forEach(obj => this.getMaterialsInner(obj));
    }
    const mat = (object as any).material;
    if (mat && Array.isArray(mat) && mat.length > 0) {
      mat.forEach(m => {
        this.checkAndAddMaterial(m);
      });
    } else if (mat instanceof THREE.Material) {
      this.checkAndAddMaterial(mat);
    }
  }

  checkAndAddMaterial(material: THREE.Material) {
    const item = this.materialData.find(item => item.materialId === material.id);
    if (item) {
      // if material already exist in materialData
      item.refCount++;
    } else {
      this.materials.push(material);
      const m = material as any;
      const color = m.color ? this.color2Str(m.color) : "";
      this.materialData.push({ materialId: material.id, name: material.name, type: material.type, color, refCount: 1 });
    }
  }

  handleRowClick(row: TableRow, event: any, column: any) {
    this.selectedMaterialIndex = this.materials.findIndex(m => m.id === row.materialId);
  }

  // color string is in format of "#000000" or "rgba(0, 0, 0 ,0)"
  handleColorChange(material: THREE.Material, val: string) {
    const m = material as any;
    if (!m.color) {
      return;
    }
    const c = new THREE.Color(val);
    m.color.setRGB(c.r, c.g, c.b);
    if (this.viewer) {
      this.viewer.enableRender();
    }
    // TODO: change the color in table
  }

  handleTransparentChange(material: THREE.Material, val: boolean) {
    material.transparent = val;
    if (this.viewer) {
      this.viewer.enableRender();
    }
  }

  handleOpacityChange(material: THREE.Material, val: number) {
    material.opacity = val;
    if (this.viewer) {
      this.viewer.enableRender();
    }
  }

  handleRoughnessChange(material: THREE.Material, val: number) {
    const m = material as any;
    if (m.roughness == null) {
      return; // if null or undefined, return
    }
    m.roughness = val;
    if (this.viewer) {
      this.viewer.enableRender();
    }
  }

  handleMetalnessChange(material: THREE.Material, val: number) {
    const m = material as any;
    if (m.metalness == null) {
      return; // if null or undefined, return
    }
    m.metalness = val;
    if (this.viewer) {
      this.viewer.enableRender();
    }
  }

  colorFormatter(row: TableRow, column: any, cellValue: any, index: any) {
    const id = row.materialId;
    const material = this.materials.find(m => m.id === id);
    let alpha = "";
    if (material && material.transparent) {
      alpha = this.opacity2HexStr(material.opacity);
    }
    // only store 'background-color' into style
    const element: VNode = <div class="color-block" style="background-color: "></div>;
    if (element.data && element.data.style) {
      element.data.style = `background-color: ${cellValue}${alpha}`;
    }
    return element;
  }

  /**
   * Converts THREE.Color to string like '#ffffff'
   */
  color2Str(color: THREE.Color): string {
    return `#${color.getHexString()}`;
  }

  /**
   * Converts opacity to hex string, e.g. 1 => FF
   */
  opacity2HexStr(opacity: number): string {
    return Math.round(opacity * 255).toString(16);
  }

  protected render(): VNode {
    const title = "Material Manager";
    const scopedSlots = {
      header: () => title,
      content: () => {
        let editorDiv: any = "";
        if (this.selectedMaterialIndex >= 0) {
          const m = this.materials[this.selectedMaterialIndex] as any;
          let color = "#ffffff";
          if (m.color && m.color.getHexString) {
            color = this.color2Str(m.color);
          }
          editorDiv = <div class="material-editor">
            <div class="setting-row">
              <div class="setting-cell">Color</div>
              <div class="setting-cell">
                <el-color-picker value={ color } size="mini" color-format="hex"
                  disabled={ !m.color }
                  onInput={ (val: string) => this.handleColorChange(m, val) }
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-cell">Enable transparent</div>
              <div class="setting-cell">
                <el-checkbox value={ m.transparent }
                  onChange={ (val: boolean) => this.handleTransparentChange(m, val) }
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-cell">Opacity</div>
              <div class="setting-cell">
                <el-slider value={ m.opacity || 0 } min={ 0 } max={ 1 } step={ 0.1 }
                  onInput={ (val: number) => this.handleOpacityChange(m, val) }
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-cell">Roughness</div>
              <div class="setting-cell">
                <el-slider value={ m.roughness || 0 } min={ 0 } max={ 1 } step={ 0.1 }
                  disabled={ m.roughness == null }
                  onInput={ (val: number) => this.handleRoughnessChange(m, val) }
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-cell">Metalness</div>
              <div class="setting-cell">
                <el-slider value={ m.metalness || 0 } min={ 0 } max={ 1 } step={ 0.1 }
                  disabled={ m.metalness == null }
                  onInput={ (val: number) => this.handleMetalnessChange(m, val) }
                />
              </div>
            </div>
          </div>;
        } else {
          editorDiv = <div class="material-editor"><span class="no-selection">Please choose a material</span></div>;
        }
        return <div class="popup-body">
          <div class="object-info">
            <span>Object Uuid: { this.objectUuid }</span>
          </div>
          <el-table data={ this.materialData } size="mini" border stripe highlight-current-row width="100%" max-height="200"
            on-row-click={ this.handleRowClick }>
            <el-table-column prop="materialId" width="80" label="Id" align="center" fixed sortable show-overflow-tooltip />
            <el-table-column prop="name" width="*" label="Name" header-align="center" sortable show-overflow-tooltip />
            <el-table-column prop="type" width="*" label="Type" header-align="center" sortable show-overflow-tooltip />
            <el-table-column prop="color" width="50" label="Color" align="center" formatter={ this.colorFormatter } />
            <el-table-column prop="refCount" width="100" label="Ref count" align="center" sortable show-overflow-tooltip />
          </el-table>
          { editorDiv }
        </div>;
      }
    };

    return (
      <BasePanel
        ref="materialManagerPanel"
        class={ styles.materialManager }
        v-show={this.visible}
        onClose={this.close}
        {...{ scopedSlots }}>
      </BasePanel>
    );
  }
}
