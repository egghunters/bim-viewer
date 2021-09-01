import _ from "lodash";
import { Message } from "element-ui";
import axios, { AxiosRequestConfig, Canceler } from "axios";
import Vue from "vue";

export interface PendingRequest {
  id: string;
  cancel: Canceler;
}

/**
  * Prompts error message
  * @param {string} message error message
  * @param {number} status error code
  */
export const pushErrorMessage = (message: string, status?: string) => {
  Message.error(`${message} ${status ? "(" + status + ")" : ""}`);
};

/**
  * General error handler
  * @param {Object} error error object
  */
export const errorHandler = (error: any) => {
  const { response, code, message } = error;
  if (response) {
    const { status } = response;
    const { error } = response.data;
    switch (status) {
    // 404 not found
      case 404:
        pushErrorMessage((error && error.errorMsg) || "Not found", status);
        break;
      case 500:
        pushErrorMessage((error && error.errorMsg) || "Server internal error", status);
        break;
      default:
        if (error.errorMsg) {
          pushErrorMessage(error.errorMsg, error.code);
        }
    }
  } else {
    if (code === "ECONNABORTED" && message.indexOf("timeout") > -1) {
      pushErrorMessage("Request timeout", code);
    } else {
      pushErrorMessage(message);
    }
  }
};

/**
 * General response handler
*/
export function responseHandler(response: any) {
  const { code, msg } = response.data;
  switch (code) {
  // TODO: enum
  // case 0:
  //   pushErrorMessage(msg)
  //   return Promise.reject(response)
    default:
      return response;
  }
}

export function genRequestId(url: string, method: AxiosRequestConfig["method"], data: any) {
  return `${url}&${method}` + (data ? `&${JSON.stringify(data)}` : "");
}

export function cancelPending(requestId: string) {
  _.remove(Vue.prototype.$pendingRequests as PendingRequest[], (p: any) => {
    if (p.id === requestId) {
      p.cancel();
      return true;
    }
  });
}

// creat axios instance
const instance = axios.create({
  timeout: 1000 * 120
});
// set post header
instance.defaults.headers.post["Content-Type"] = "application/json;charset=UTF-8";

// request intercept
instance.interceptors.request.use(config => {
  if (config.url) {
    const requestId = genRequestId(config.url, config.method, config.data);
    // cancel operation before an axios request
    cancelPending(requestId);
    config.cancelToken = new axios.CancelToken(c => {
      Vue.prototype.$pendingRequests && Vue.prototype.$pendingRequests.push({ id: requestId, cancel: c } as PendingRequest);
    });
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// response intercept
instance.interceptors.response.use(response => {
  if (response.config.url) {
    // handle response
    const requestId = genRequestId(response.config.url, response.config.method, response.config.data);
    cancelPending(requestId);
  }
  return responseHandler(response);
}, error => {
  if (error && error.constructor && error.constructor.name === "Cancel") {
    return { data: {} };
  }
  errorHandler(error);
  return Promise.reject(error);
}
);

export default instance;
