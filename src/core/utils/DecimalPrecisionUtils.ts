import { decimalPrecisionRange } from "@/components/projectSettingsPanel/ProjectSettingsDef";

export const showPrecisionValue = (value: number, precistionType: number) => {
  const str = value.toFixed(precistionType === decimalPrecisionRange["Precision from file"] ? 2 : precistionType);
  return str;
};
