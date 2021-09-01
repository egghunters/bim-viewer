import Projects from "@/views/projects/Projects";
import ProjectPanel from "@/components/projects/ProjectPanel";
import Vue from "vue";
import VueRouter, { RouteConfig } from "vue-router";

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: "/projects",
    name: "Projects",
    component: Projects
  },
  {
    path: "/projects/:projectId",
    name: "ProjectPanel",
    component: ProjectPanel
  },
  {
    path: "/",
    name: "Index",
    component: Projects
  }
];

const router = new VueRouter({
  routes
});

export default router;
