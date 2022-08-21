import * as ProjectSettingType from "./ProjectSettingsDef";
import { Component, Vue, Prop } from "vue-property-decorator";
import { cloneDeep } from "lodash";
import { Settings as SettingsType, defaultSettings, cameraNearRange, cameraFarRange, unitRange, sensitivityRange, decimalPrecisionRange, settingStoreKeyName } from "@/components/projectSettingsPanel/ProjectSettingsDef";
import { Types as VuexTypes } from "../../store";
import styles from "./ProjectSettings.module.scss";
import Viewer3D from "@/core/Viewer3D";

@Component
export default class ProjectSettingsPanel extends Vue {
  @Prop({ required: true }) projectId!: string;
  @Prop({ required: true }) viewer!: Viewer3D;
  activeName = "1";
  settings: ProjectSettingType.Settings = ProjectSettingType.defaultSettings;

  changeTab(e: any) {
  }

  initProjectSettings() {
    const savedSettings: SettingsType = localStorage.getItem(settingStoreKeyName + "_" + this.projectId) && JSON.parse(localStorage.getItem(settingStoreKeyName + "_" + this.projectId) || "");
    const result = cloneDeep(defaultSettings);
    if (savedSettings) {
      Object.assign(result, cloneDeep(savedSettings));
    }
    this.settings = result;
  }

  restore(tabId: Number) {
    if (tabId === 1) {
      this.settings.unit = defaultSettings.unit;
      this.settings.decimalPrecision = defaultSettings.decimalPrecision;
      this.settings.camera = defaultSettings.camera;
    }
    if (tabId === 2) {
      this.settings.mouse = defaultSettings.mouse;
      this.settings.keyboard = defaultSettings.keyboard;
    }
  }

  close() {
    this.$emit("update:visible", false);
  }

  save() {
    this.$store.commit(VuexTypes.MUTATION_PROJECT_SETTINGS, this.settings);
    localStorage.setItem(settingStoreKeyName + "_" + this.projectId, JSON.stringify(this.settings));
    if (this.viewer) {
      this.viewer.updateProjectSettings(this.settings);
    }
    this.close();
  }

  mounted() {
    this.initProjectSettings();
  }

  render() {
    const options1 = [];
    const options2 = [];
    let key: string;
    for (key in unitRange) {
      options1.push(<el-option value={unitRange[key]} label={key}></el-option>);
    }
    for (key in decimalPrecisionRange) {
      options2.push(<el-option value={decimalPrecisionRange[key]} label={key}></el-option>);
    }
    return (
      <div class={styles.psetting}>
        <el-tabs v-model={this.activeName} onTabClick={this.changeTab}>
          <el-tab-pane label="Common" name="1">
            <div ref="panel1">
              <el-form ref="form">
                <el-form-item label="Units">
                  <el-select value={this.settings.unit} onInput={(val: string) => (this.settings.unit = val)}>
                    {options1}
                  </el-select>
                </el-form-item>
                <el-form-item label="Precision">
                  <el-select value={this.settings.decimalPrecision} onInput={(val: number) => (this.settings.decimalPrecision = val)}>
                    {options2}
                  </el-select>
                </el-form-item>
                <h3 style="margin-bottom:20px;margin-bottom:20px;">Camera:</h3>
                <div class={styles.sliderWrap}>
                  <span class="demonstration">Near:</span>
                  <el-slider step={0.1} min={cameraNearRange[0]} max={cameraNearRange[1]} v-model={this.settings.camera.near}>
                  </el-slider>
                </div>
                <div class={styles.sliderWrap}>
                  <span class="demonstration">Far:</span>
                  <el-slider step={1} min={cameraFarRange[0]} max={cameraFarRange[1]} v-model={this.settings.camera.far}>
                  </el-slider>
                </div>
                <p style="text-align:center;margin-bottom:20px;">
                  <el-button onClick={() => this.restore(1)}>Reset Settigns</el-button>
                </p>
                <p class={styles.btnWrap}>
                  <el-button onClick={() => { this.close() } }>Cancel</el-button>
                  <el-button onClick={() => { this.save() } }>Save</el-button>
                </p>
              </el-form>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Navigation" name="2">
            <div ref="panel2">
              <el-form ref="form2" label-width="100px">
                <el-form-item label="Mouse Sensitivity">
                  <el-slider style="margin-right:10px;" value={this.settings.mouse.sensitivity} min={sensitivityRange[0]} max={sensitivityRange[1]} onInput={(val: number) => {
                    this.settings.mouse.sensitivity = val;
                  }}>
                  </el-slider>
                </el-form-item>
                <el-form-item label="Keyboard Sensitivity">
                  <el-slider style="margin-right:10px;" value={this.settings.keyboard.sensitivity} min={sensitivityRange[0]} max={sensitivityRange[1]} onInput={(val: number) => {
                    this.settings.keyboard.sensitivity = val;
                  }}>
                  </el-slider>
                </el-form-item>
                <p style="text-align:center;margin-bottom:20px;">
                  <el-button onClick={() => this.restore(2)}>Reset Settigns</el-button>
                </p>
                <p class={styles.btnWrap}>
                  <el-button onClick={() => { this.close() } }>Cancel</el-button>
                  <el-button onClick={() => { this.save() } }>Save</el-button>
                </p>
              </el-form>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    );
  }
}
