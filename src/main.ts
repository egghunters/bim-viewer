import { PostmateManager } from "./core/postmate/PostmateManager";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import Vue from "vue";

import "./plugins/element.ts";
import axios from "axios";

Vue.config.productionTip = false;

startApp();

async function startApp() {
  Vue.config.productionTip = false;

  PostmateManager.instance(); // initialize PostmateManager
  await loadConfig(); // need to run later code after this is done

  new Vue({
    router,
    store,
    render: h => h(App)
  }).$mount("#app");
}

async function loadConfig() {
  try {
    const baseURL = process.env.BASE_URL;
    const configFile = "config/base.json";
    const res = await axios.get(configFile, { baseURL });
    Vue.prototype.$config = res.data;
  } catch (e) {
    console.error(e);
  }
}
