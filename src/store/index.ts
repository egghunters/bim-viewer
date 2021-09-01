import { Project } from "@/core/ProjectManager";
import { Settings as SettingsType } from "@/components/projectSettingsPanel/ProjectSettingsDef";
import Vue from "vue";
import Vuex, { StoreOptions } from "vuex";

Vue.use(Vuex);

export enum Types {
  STATE_ACTIVE_PROJECT = "activeProject",
  GETTER_ACTIVE_PROJECT = "getActiveProject",
  MUTATION_ACTIVE_PROJECT = "setActiveProject",

  STATE_SHOW_BIM_TREE = "showBimTree",
  GETTER_SHOW_BIM_TREE = "getShowBimTree",
  MUTATION_SHOW_BIM_TREE = "setShowBimTree",

  STATE_SHOW_LAYER_MANAGER = "showLayerManager",
  GETTER_SHOW_LAYER_MANAGER = "getShowLayerManager",
  MUTATION_SHOW_LAYER_MANAGER = "setShowLayerManager",

  STATE_SHOW_PROPERTY_PANEL = "showPropertyPanel",
  GETTER_SHOW_PROPERTY_PANEL = "getShowPropertyPanel",
  MUTATION_SHOW_PROPERTY_PANEL = "setShowPropertyPanel",

  STATE_SHOW_SNAPSHOT_PANEL = "showSnapshotPanel",
  GETTER_SHOW_SNAPSHOT_PANEL = "getShowSnapshotPanel",
  MUTATION_SHOW_SNAPSHOT_PANEL = "setShowSnapshotPanel",

  STATE_SHOW_VIEWPOINTS = "showViewpoints",
  GETTER_SHOW_VIEWPOINTS = "getShowViewpoints",
  MUTATION_SHOW_VIEWPOINTS = "setShowViewpoints",

  STATE_SHOW_ANNOTATIONS = "showAnnotations",
  GETTER_SHOW_ANNOTATIONS = "getShowAnnotations",
  MUTATION_SHOW_ANNOTATIONS = "setShowAnnotations",

  STATE_SHOW_PROJECT_SETTINGS_PANEL = "showProjectSettingsPanel",
  GETTER_SHOW_PROJECT_SETTINGS_PANEL = "getShowProjectSettingsPanel",
  MUTATION_SHOW_PROJECT_SETTINGS_PANEL = "setShowProjectSettingsPanel",

  STATE_PROJECT_SETTINGS = "projectSettings",
  GETTER_PROJECT_SETTINGS = "getProjectSettings",
  MUTATION_PROJECT_SETTINGS = "setProjectSettings",

  STATE_OBJECT_UUID_FOR_MATERIAL_MANAGER = "objectUuidForMaterialManager",
  GETTER_OBJECT_UUID_FOR_MATERIAL_MANAGER = "getObjectUuidForMaterialManager",
  MUTATION_OBJECT_UUID_FOR_MATERIAL_MANAGER = "setObjectUuidForMaterialManager"
}

export interface RootState {
  activeProject: Project; // active project which is defined in ProjectManager
  showBimTree: boolean; // to indicate if BimTree data need to update
  showLayerManager: boolean; // to indicate if layer manager panel is visible
  showPropertyPanel: boolean; // to indicate if layer manager panel is visible
  showSnapshotPanel: boolean;
  showViewpoints: boolean;
  showAnnotations: boolean;
  projectSettings: SettingsType|null;
  showProjectSettingsPanel: boolean;
  objectUuidForMaterialManager: string | null; // to store the object uuid for Material manager panel
  showMaterialManagerPanel: boolean
}

const store: StoreOptions<RootState> = {
  state: {
    [Types.STATE_ACTIVE_PROJECT]: {},
    [Types.STATE_SHOW_BIM_TREE]: false,
    [Types.STATE_SHOW_LAYER_MANAGER]: false,
    [Types.STATE_SHOW_PROPERTY_PANEL]: false,
    [Types.STATE_SHOW_SNAPSHOT_PANEL]: false,
    [Types.STATE_SHOW_VIEWPOINTS]: false,
    [Types.STATE_SHOW_ANNOTATIONS]: false,
    [Types.STATE_PROJECT_SETTINGS]: null,
    [Types.STATE_SHOW_PROJECT_SETTINGS_PANEL]: false,
    [Types.STATE_OBJECT_UUID_FOR_MATERIAL_MANAGER]: null
  } as RootState,
  mutations: {
    [Types.MUTATION_ACTIVE_PROJECT](state: RootState, val: Project) {
      state[Types.STATE_ACTIVE_PROJECT] = val;
    },
    [Types.MUTATION_SHOW_BIM_TREE](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_BIM_TREE] = val;
    },
    [Types.MUTATION_SHOW_LAYER_MANAGER](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_LAYER_MANAGER] = val;
    },
    [Types.MUTATION_SHOW_PROPERTY_PANEL](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_PROPERTY_PANEL] = val;
    },
    [Types.MUTATION_SHOW_SNAPSHOT_PANEL](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_SNAPSHOT_PANEL] = val;
    },
    [Types.MUTATION_SHOW_VIEWPOINTS](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_VIEWPOINTS] = val;
    },
    [Types.MUTATION_SHOW_ANNOTATIONS](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_ANNOTATIONS] = val;
    },
    [Types.MUTATION_SHOW_PROJECT_SETTINGS_PANEL](state: RootState, val: boolean) {
      state[Types.STATE_SHOW_PROJECT_SETTINGS_PANEL] = val;
    },
    [Types.MUTATION_PROJECT_SETTINGS](state: RootState, val: SettingsType) {
      state[Types.STATE_PROJECT_SETTINGS] = val;
    },
    [Types.MUTATION_OBJECT_UUID_FOR_MATERIAL_MANAGER](state: RootState, val: string | null) {
      state[Types.STATE_OBJECT_UUID_FOR_MATERIAL_MANAGER] = val;
    }
  },
  actions: {
  },
  modules: {
  },
  getters: {
    [Types.GETTER_ACTIVE_PROJECT](state) {
      return state[Types.STATE_ACTIVE_PROJECT];
    },
    [Types.GETTER_SHOW_BIM_TREE](state) {
      return state[Types.STATE_SHOW_BIM_TREE];
    },
    [Types.GETTER_SHOW_LAYER_MANAGER](state) {
      return state[Types.STATE_SHOW_LAYER_MANAGER];
    },
    [Types.GETTER_SHOW_PROPERTY_PANEL](state) {
      return state[Types.STATE_SHOW_PROPERTY_PANEL];
    },
    [Types.GETTER_SHOW_SNAPSHOT_PANEL](state) {
      return state[Types.STATE_SHOW_SNAPSHOT_PANEL];
    },
    [Types.GETTER_SHOW_VIEWPOINTS](state) {
      return state[Types.STATE_SHOW_VIEWPOINTS];
    },
    [Types.GETTER_SHOW_ANNOTATIONS](state) {
      return state[Types.STATE_SHOW_ANNOTATIONS];
    },
    [Types.GETTER_SHOW_PROJECT_SETTINGS_PANEL](state) {
      return state[Types.STATE_SHOW_PROJECT_SETTINGS_PANEL];
    },
    [Types.GETTER_PROJECT_SETTINGS](state) {
      return state[Types.STATE_PROJECT_SETTINGS];
    },
    [Types.GETTER_OBJECT_UUID_FOR_MATERIAL_MANAGER](state) {
      return state[Types.STATE_OBJECT_UUID_FOR_MATERIAL_MANAGER];
    }
  }
};

export default new Vuex.Store<RootState>(store);
