import { AxiosRequestConfig } from "axios";
import instance from "./interceptor";
import qs from "querystring";

export function get(url: string, params?: any, config: AxiosRequestConfig = {}) {
  return instance.get(url, {
    ...config,
    params,
    paramsSerializer: (params: any) => {
      return qs.stringify(params);
    }
  });
}

export function post(url: string, data?: any, config: AxiosRequestConfig = {}) {
  return instance.post(url, data, {
    // baseURL: Vue.prototype?.$config?.threeJsBimService,
    ...config
  });
}
