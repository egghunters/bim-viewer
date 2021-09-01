/**
 * Perspective and Orthographic camera share the same settings
 */
export interface CameraSettings {
  near: number,
  far: number
}

export interface MouseSetting {
  sensitivity: number
}

export interface KeyboardSetting {
  sensitivity: number
}

export interface Settings {
  unit: string,
  decimalPrecision: number,
  camera: CameraSettings,
  mouse: MouseSetting,
  keyboard: KeyboardSetting
}

export const defaultSettings: Settings = {
  unit: "file",
  decimalPrecision: 99,
  camera: {
    near: 0.5,
    far: 30000
  },
  mouse: {
    sensitivity: 3
  },
  keyboard: {
    sensitivity: 3
  }
};

export const cameraNearRange = [0.1, 100];

export const cameraFarRange = [1000, 50000];

export const unitRange: {[key: string]: string} = {
  "Unit from file": "file",
  Meter: "m",
  Milimeter: "mm",
  Centimeter: "cm",
  Feet: "ft",
  Inch: "in",
  Point: "pt"
};

export const sensitivityRange = [1, 5];

export const decimalPrecisionRange: {[key: string]: number} = {
  "Precision from file": 99,
  "0(1)": 0,
  "0.1(1/2)": 1,
  "0.01(1/4)": 2,
  "0.001(1/8)": 3,
  "0.0001(1/16)": 4,
  "0.00001(1/32)": 5,
  "0.000001(1/64)": 6
};

export const settingStoreKeyName = "THREE_RENDER_SETTING";
