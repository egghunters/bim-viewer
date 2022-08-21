import * as THREE from "three";
import { getProjects } from "@/service/project";
import axios from "axios";

export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  camera?: CameraConfig; // eslint-disable-line
  models: Model[]; // eslint-disable-line
}

export interface CameraConfig {
  eye: number[] | THREE.Vector3;
  look: number[] | THREE.Vector3;
}

export interface Model {
  name?: string;
  src: string;
  position?: number[];
  rotation?: number[];
  scale?: number[];
  instantiate?: boolean; // if we want to do instantiate to the model
  merge?: boolean; // if we want to merge mesh with the same materials
  edges?: boolean; // if we want to generate and show edges/outline to the modle
  propertyFile?: string;
  visible?: boolean; // default value is true. won't load a model when invisible
}

/**
 * Class for ProjectManager
 * There are two kind of projects:
 * 1) Demo project, which is defined in 'public/config/projects.json', and stored in 'public/three/projects'
 * 2) Common project, which is stored in back-end service (not implemented yet until today 2021.6)
 */
export class ProjectManager {
  static customProjects: Project[] = []; // stores online projects

  /**
   * Gets demo projects
   */
  public static getSampleProjects(): Promise<Project[]> {
    const baseURL = process.env.BASE_URL;
    const configFile = "config/projects.json";
    return new Promise<Project[]>((resolve, reject) => {
      axios.get(configFile, { baseURL }).then(res => {
        const projects = res.data;
        resolve(projects);
      }).catch(reason => {
        console.error(reason);
        reject(reason);
      });
    });
  }

  /**
   * Gets online projects
   * TODO: handle pagging, filter, etc. when there are many projects
   */
  public static async getCustomProjects(forceRefetch = false): Promise<Project[]> {
    if (!ProjectManager.customProjects || ProjectManager.customProjects.length < 1 || forceRefetch) {
      // if list is empty or user want to fetch from online, then fetch from online
      try {
        const projects = await getProjects();
        if (!projects) {
          console.warn(`Failed to load online projects: ${projects}`);
        }
        ProjectManager.customProjects = projects.map((proj: any) => {
          return {
            id: proj._id,
            name: proj.name,
            models: []
          };
        }) || [];
        console.log(`ProjectManager.customProjects: ${ProjectManager.customProjects}`);
        return ProjectManager.customProjects;
      } catch (e) {
        console.warn(`Failed to load online projects, error: ${e}`);
      }
    }
    return Promise.resolve(ProjectManager.customProjects);
  }

  /**
   * Gets a project
   */
  public static async getProject(id: string): Promise<Project> {
    const projects = await ProjectManager.getCustomProjects();
    const project = projects ? projects.find(p => p.id === id) : undefined;
    if (!project) {
      // TODO: need to get project from backend, because projects are possibly not loaded yet
      throw Error(`Failed to get project with id: ${id}`);
    }
    return Promise.resolve(project);
  }

  public static addCustomProject(project: Project): (Project) {
    ProjectManager.customProjects.push(project);
    return project;
  }

  public static deleteCustomProject(projectId: string) {
    const index = ProjectManager.customProjects.findIndex(p => p.id === projectId);
    index > -1 && ProjectManager.customProjects.splice(index, 1);
  }

  /**
   * Converts number array to THREE.Vector3
   */
  public static arrayToVector3(arr: number[] | THREE.Vector3 | undefined): THREE.Vector3 | undefined {
    if (!arr) {
      return arr;
    } else if (arr instanceof THREE.Vector3) {
      return arr;
    } else if (Array.isArray(arr) && arr.length >= 3) {
      return new THREE.Vector3(arr[0], arr[1], arr[2]);
    }
  }

  /**
   * Converts number array to THREE.Euler
   */
  public static arrayToEuler(arr: number[] | THREE.Euler | undefined): THREE.Euler | undefined {
    if (!arr) {
      return arr;
    } else if (arr instanceof THREE.Euler) {
      return arr;
    } else if (Array.isArray(arr) && arr.length >= 3) {
      return new THREE.Euler(arr[0], arr[1], arr[2]);
    }
  }
}
