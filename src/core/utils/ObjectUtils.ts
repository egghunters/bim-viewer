import * as THREE from "three";
import { matrixAutoUpdate } from "@/core/Constants";
import Exploder from "../exploder/Exploder";
import SceneUtils from "./SceneUtils";

export interface MaterialInfo {
  uuid: string;
  material?: THREE.Material,
  clonedMaterial?: THREE.Material,
  opacity: number;
  transparent: boolean;
}

/**
 * Util class for Threejs Object
 */
export class ObjectUtils {
  /**
   * Clears any styles, including transparency, wireframe mode, filter by floor, etc.
   * @param object
   */
  public static resetObjectStyle(object: THREE.Object3D) {
    this.revertWireframeMode(object);
    // as we don't know the materialInfoList, there is side effect that the opacity will be set to 1.0
    this.revertObjectOpacity(object, []);
    // revert visible
    this.revertVisibleForFloors(object);
  }

  /**
   * Clears any styles, including transparency, wireframe mode, filter by floor, etc.
   */
  public static resetObjectStyleByUuid(scene: THREE.Scene, uuid: string) {
    const object = this.getObjectByUuid(scene, uuid);
    this.resetObjectStyle(object);
  }

  /**
   * Sets an object's opacity
   * @returns returns MaterialInfo list in case caller want to revert the opacity
   */
  public static setObjectOpacity(object: THREE.Object3D, opacity = 0.3, includeObjectUuids?: string[], excludeObjectUuids?: string[]): MaterialInfo[] {
    // need to store the original materials' opacity, so that we can revert the transparent mode back
    const materialInfoList: MaterialInfo[] = [];
    const addOpacity = (mat: THREE.Material) => {
      // only add it when there is no such a material in cache list yet
      if (!materialInfoList.find(m => m.uuid === mat.uuid)) {
        materialInfoList.push({ uuid: mat.uuid, opacity: mat.opacity, transparent: mat.transparent });
        mat.opacity *= opacity; // shouldn't set to target opacity directly, because it may already has opacity
        mat.transparent = true;
      }
    };
    const addOpacityForClonedMaterial = (mat: THREE.Material): THREE.Material | undefined => {
      // only add it when there is no such a material in cache list yet
      const matInfo = materialInfoList.find(m => m.uuid === mat.uuid);
      if (!matInfo) {
        const clonedMaterial = mat.clone();
        materialInfoList.push({ uuid: mat.uuid, opacity: mat.opacity, transparent: mat.transparent, material: mat, clonedMaterial });
        clonedMaterial.opacity *= opacity; // shouldn't set to target opacity directly, because it may already has opacity
        clonedMaterial.transparent = true;
        return clonedMaterial;
      }
      return matInfo.clonedMaterial;
    };
    object.traverse(obj => {
      if (excludeObjectUuids && excludeObjectUuids.indexOf(obj.uuid) !== -1) {
        return; // excluded
      }
      if (includeObjectUuids && includeObjectUuids.indexOf(obj.uuid) === -1) {
        return; // not in include list
      }
      // probably not only Mesh, but also some other object like InstancedMesh should be considered!
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        // if there is any includeObjectUuids, we should copy materials rather than change them directly
        if (includeObjectUuids) {
          if (Array.isArray(mesh.material)) {
            const materials: THREE.Material[] = [];
            mesh.material.forEach(mat => {
              const m = addOpacityForClonedMaterial(mat);
              if (m) {
                materials.push(m);
              }
            });
            mesh.material = materials;
          } else if (mesh.material) {
            const m = addOpacityForClonedMaterial(mesh.material);
            if (m) {
              mesh.material = m;
            }
          }
        } else {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              addOpacity(mat);
            });
          } else if (mesh.material) {
            const mat = mesh.material;
            addOpacity(mat);
          }
        }
      }
    });
    return materialInfoList;
  }

  /**
   * Reverts an object's opacity
   * @param object the root object
   */
  public static revertObjectOpacity(object: THREE.Object3D, materialInfoList: MaterialInfo[], includeObjectUuids?: string[], excludeObjectUuids?: string[]) {
    const revertOpacity = (mat: THREE.Material) => {
      // revert opacity for this material
      const material = materialInfoList.find(m => m.uuid === mat.uuid);
      if (material) {
        mat.opacity = material.opacity;
        mat.transparent = material.transparent;
      } else {
        // if we cannot find the MaterialInfo, still need to set opacity to 1.0
        mat.opacity = 1.0;
      }
    };
    const tryGetOriginalMaterial = (mat: THREE.Material) => {
      // check if the passed in mat is a cloned one
      const matInfo = materialInfoList.find(m => m.clonedMaterial && m.clonedMaterial.uuid === mat.uuid);
      if (matInfo) {
        return matInfo.material;
      }
      return undefined;
    };
    object.traverse(mesh => {
      if (excludeObjectUuids && excludeObjectUuids.indexOf(mesh.uuid) !== -1) {
        return; // excluded
      }
      if (includeObjectUuids && includeObjectUuids.indexOf(mesh.uuid) === -1) {
        return; // not in include list
      }
      // probably not only Mesh, but also some other object like InstancedMesh should be considered!
      if (mesh instanceof THREE.Mesh) {
        // if there is any includeObjectUuids, we should copy materials rather than change them directly
        if (includeObjectUuids) {
          if (Array.isArray(mesh.material)) {
            const materials: THREE.Material[] = [];
            mesh.material.forEach(mat => {
              const m = tryGetOriginalMaterial(mat);
              if (m) {
                materials.push(m);
              }
            });
            mesh.material = materials;
          } else if (mesh.material) {
            const m = tryGetOriginalMaterial(mesh.material);
            if (m) {
              mesh.material = m;
            }
          }
        } else {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
              revertOpacity(mat);
            });
          } else if (mesh.material) {
            const mat = mesh.material;
            revertOpacity(mat);
          }
        }
      }
    });
  }

  /**
   * Sets an object's opacity
   */
  public static setObjectOpacityByUuid(scene: THREE.Scene, uuid: string, opacity = 0.3, includeObjectUuids?: string[], excludeObjectUuids?: string[]): MaterialInfo[] {
    const object = scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      throw new Error(`Failed to find object by uuid: ${uuid}`);
    }
    return ObjectUtils.setObjectOpacity(object, opacity, includeObjectUuids, excludeObjectUuids);
  }

  /**
   * Reverts an object's opacity
   */
  public static revertObjectOpacityByUuid(scene: THREE.Scene, uuid: string, materialInfoList: MaterialInfo[], includeObjectUuids?: string[], excludeObjectUuids?: string[]) {
    const object = scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      throw new Error(`Failed to find object by uuid: ${uuid}`);
    }
    ObjectUtils.revertObjectOpacity(object, materialInfoList, includeObjectUuids, excludeObjectUuids);
  }

  /**
   * Explodes an object
   */
  public static explodeObject(scene: THREE.Scene, object: THREE.Object3D, explodeUp = false): Exploder {
    const position = new THREE.Vector3();
    SceneUtils.getPositionCenter(object, position);
    const exploder = new Exploder(scene, object.id, position);
    exploder.setOnlyExplodeUp(explodeUp);
    exploder.explode();
    return exploder;
  }

  /**
   * Unexplodes an object
   */
  public static unexplodeObject(exploder: Exploder) {
    if (!exploder) {
      throw new Error("Invalid exploder!");
    }
    exploder.unexplode();
  }

  /**
   * Sets an object to be wireframe mode.
   * In order to revert wireframe mode, we'll store original material in userData: {
   *   materialForWireframe: THREE.Material
   * }
   * It seems wireframe mode have performance degradation, look at here for more info:
   * https://stackoverflow.com/questions/45917611/shader-wireframe-of-an-object
   */
  public static setWireframeMode(object: THREE.Object3D) {
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5000,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    object.traverseVisible(obj => {
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        mesh.userData.materialForWireframe = mesh.material;
        mesh.material = wireframeMaterial;
      }
    });
  }

  /**
   * Sets an object to be wireframe mode.
   */
  public static setWireframeModeByUuid(scene: THREE.Scene, uuid: string) {
    const object = scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      throw new Error(`Failed to find object by uuid: ${uuid}`);
    }
    ObjectUtils.setWireframeMode(object);
  }

  /**
   * Reverts an object to be non-wireframe mode.
   */
  public static revertWireframeMode(object: THREE.Object3D) {
    object.traverseVisible(obj => {
      if (obj instanceof THREE.Mesh) {
        // caller need to make sure there is userData.materialForWireframe
        if (obj.userData.materialForWireframe) {
          obj.material = obj.userData.materialForWireframe;
          obj.userData.materialForWireframe = undefined; // clean it up
        }
      }
    });
  }

  /**
   * Reverts an object to be non-wireframe mode.
   */
  public static revertWireframeModeByUuid(scene: THREE.Scene, uuid: string) {
    const object = scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      throw new Error(`Failed to find object by uuid: ${uuid}`);
    }
    ObjectUtils.revertWireframeMode(object);
  }

  /**
   * Finds objects by name, id, userData, etc.
   * @param scene
   * @param targetUuids target object uuids to find from
   * @param searchText search text
   * @param findFirst only find the first
   */
  private static findInner(scene: THREE.Scene, searchText: string, targetUuids: string[] = [], findFirst = false): THREE.Object3D[] {
    const val = searchText.toLowerCase();
    const results: THREE.Object3D[] = [];

    const matchStr = (str: string) => {
      return str.toLowerCase().indexOf(val) !== -1;
    };
    const matchNum = (num: number) => {
      return num.toString().indexOf(val) !== -1;
    };
    const matchUserData = (userData: any) => {
      if (userData.name) {
        if (userData.name.toLowerCase().indexOf(val) !== -1) {
          return true;
        }
      }
      if (userData.gltfExtensions) {
        const ext = userData.gltfExtensions;
        const id = (ext.objectId && ext.objectId.Value) || (ext.elementId && ext.elementId.Value);
        if (id && id.toLowerCase().indexOf(val) !== -1) {
          return true;
        }
      }
      return false;
    };

    if (targetUuids.length > 0) {
      for (let i = 0; i < targetUuids.length; ++i) {
        const uuid = targetUuids[i];
        const object = scene.getObjectByProperty("uuid", uuid);
        if (object) {
          object.traverse(obj => {
            if (matchStr(obj.name) || matchNum(obj.id) || matchUserData(obj.userData)) {
              results.push(obj);
            }
          });
        }
        if (findFirst && results.length > 0) {
          return [results[0]];
        }
      }
    } else {
      // if no target uuid is passed in, find it from whole scene
      scene.traverse(obj => {
        if (matchStr(obj.name) || matchNum(obj.id) || matchUserData(obj.userData)) {
          results.push(obj);
        }
      });
      if (findFirst && results.length > 0) {
        return [results[0]];
      }
    }
    return results;
  }

  /**
   * Finds objects by given string
   */
  public static find(scene: THREE.Scene, searchText: string, targetUuids: string[] = [], findFirst = false): THREE.Object3D[] {
    return this.findInner(scene, searchText, targetUuids);
  }

  /**
   * Finds the first object by given string
   */
  public static findFirst(scene: THREE.Scene, searchText: string, targetUuids: string[] = [], findFirst = false): THREE.Object3D | undefined {
    const results = this.findInner(scene, searchText, targetUuids, true);
    if (results.length > 0) {
      return results[0];
    }
    return undefined;
  }

  /**
   * Checks if given string contains floor
   * @param str string to match, e.g. '5F(xxx)'
   */
  private static getFloorsFromString(str: string): number[] {
    const results: number[] = [];
    // Regular text to find if there is floor in a string.
    // It matches such cases: 5F, 15F, -1F, a5F, a5F(xxx), 10.5F
    // It doesn't match cases: 5f, 5Fa, 5F_, 5F-, 10.3F
    const reg = new RegExp(/(?:-?(?:\d+(?:\.5)?)F)(?=\W|$)/, "g"); // case sensitive
    const arr = reg.exec(str);
    if (arr && arr.length > 0) {
      arr.forEach(r => {
        if (r) {
          const f = r.replace("F", "");
          const num = Number(f);
          if (num) {
            results.push(num);
          } else {
            console.log(`[OU] invalid floor: ${r}`); // TODO: remove this later
          }
        }
      });
    }
    return results;
  }

  /**
   * Matches if a string contains floor string
   * @param str string to match, e.g. '5F(xxx)'
   * @param floor '5F', etc.
   */
  private static matchFloor(str: string, floor: number): boolean {
    const results = this.getFloorsFromString(str);
    const i = results.findIndex(r => r === floor);
    return i !== -1;
  }

  /**
   * Matches if a string contains one of floor string in floors
   * @param str string to match, e.g. '5F(xxx)'
   * @param floor '5F', etc.
   */
  private static matchFloors(str: string, floors: number[]): boolean {
    const results = this.getFloorsFromString(str);
    const i = results.findIndex(r => {
      const j = floors.findIndex(f => f === r);
      return j !== -1;
    });
    return i !== -1;
  }

  /**
   * Distincts/find floors from models, by checking children object.name
   */
  public static distinctFloors(scene: THREE.Scene, modelUuid: string[]): string[] {
    const floors: { [floor: number]: boolean } = [];

    const match = (name: string) => {
      const results = this.getFloorsFromString(name);
      results.forEach(f => {
        floors[f] = true;
      });
    };

    modelUuid.forEach(uuid => {
      const object = scene.getObjectByProperty("uuid", uuid);
      if (object) {
        object.traverse(obj => {
          match(obj.name);
          if (obj.userData.gltfExtensions) {
            const ext = obj.userData.gltfExtensions;
            if (ext.level && ext.level.Value) {
              match(ext.level.Value);
            }
          }
        });
      }
    });

    return Object.keys(floors).sort();
  }

  /**
   * Sets object's visible to true if its name, etc. match one of given floor.
   * This method won't affect other objects that don't match.
   */
  public static traverseObjectByFloors(scene: THREE.Scene, modelUuid: string, floors: number[], matchCallback?: (object: THREE.Object3D) => void, unmatchCallback?: (object: THREE.Object3D) => void) {
    const object = scene.getObjectByProperty("uuid", modelUuid);
    if (!object) {
      return [];
    }
    // const uuids: string[] = []
    object.traverse(obj => {
      let isMatch = this.matchFloors(obj.name, floors);
      if (!isMatch) {
        if (obj.userData && obj.userData.gltfExtensions) {
          const ext = obj.userData.gltfExtensions;
          if (ext.level && ext.level.Value) {
            isMatch = this.matchFloors(ext.level.Value, floors);
          }
        }
      }
      if (isMatch && matchCallback) {
        matchCallback(obj);
      }
      if (!isMatch && unmatchCallback) {
        unmatchCallback(obj);
      }
    });
  }

  /**
   * Sets object belong to given floors to be visible
   * @param modelUuid root or parent object uuid
   * @param makeUnmatchedInvisible if it should make unmatched object invisible
   */
  public static setVisibleForFloors(scene: THREE.Scene, modelUuid: string, floors: number[], makeUnmatchedInvisible = true) {
    this.traverseObjectByFloors(scene, modelUuid, floors, (object: THREE.Object3D) => {
      let obj: THREE.Object3D | undefined = object;
      while (obj) {
        obj.visible = true;
        obj = obj.parent || undefined;
      }
    }, (object: THREE.Object3D) => {
      if (makeUnmatchedInvisible) {
        object.visible = false;
      }
    });
  }

  public static revertVisibleForFloors(object: THREE.Object3D) {
    object.traverse(obj => {
      obj.visible = true;
    });
  }

  public static revertVisibleForFloorsByUuid(scene: THREE.Scene, uuid: string) {
    const object = this.getObjectByUuid(scene, uuid);
    this.revertVisibleForFloors(object);
  }

  private static getObjectByUuid(scene: THREE.Scene, uuid: string) {
    const object = scene.getObjectByProperty("uuid", uuid);
    if (!object) {
      throw new Error(`Failed to find object by uuid: ${uuid}`);
    }
    return object;
  }

  /**
   * Outline default material
   */
  private static OUTLINE_MATERIAL = new THREE.LineBasicMaterial({ name: "outline", color: 0x000000, transparent: true, opacity: 0.2 });

  /**
   * Creates outlines for given object and children
   * @param options 'replaceOriginalObject' must be used carefully, it removes original objects and cannot get back for now.
   *   It can be used in case for really large models that has a bad performace.
   */
  public static addOutlines(
    object: THREE.Object3D,
    material = this.OUTLINE_MATERIAL.clone(),
    options = { visibleOnly: true, meshOnly: true, replaceOriginalObject: false }): THREE.LineSegments[] {
    if (!object) {
      return [];
    }
    // if not a parent object and invisible and not a mesh, then ignore
    if ((object.children.length === 0) &&
      ((options.visibleOnly && !object.visible) || (options.meshOnly && !(object instanceof THREE.Mesh)))) {
      return [];
    }
    const obj = object as any;
    const length = obj.children.length;
    if (length > 0) {
      for (let i = length - 1; i >= 0; --i) { // need to iterate backward
        const o = obj.children[i];
        const lines = this.addOutlines(o, material, options);
        lines.forEach(line => line.applyMatrix4(obj.matrixWorld)); // should use matrixWorld rather than matrix
      }
    }
    if (!obj.geometry) {
      return [];
    }

    const createOutline = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.LineSegments => {
      // edges within given thresholdAngle will be ignored
      const geom = new THREE.EdgesGeometry(geometry, 5); // create EdgesGeometry from original geometry
      geom.applyMatrix4(matrix);
      // create outline and add it as a child
      const line = new THREE.LineSegments(geom, material);
      // line.position.set(obj.position.x, obj.position.y, obj.position.z) // need to set position in some case!
      // use userData: { selectable: false } to indicate an object is not selectable
      line.userData.selectable = false;
      line.userData.isOutline = true;
      line.matrixAutoUpdate = matrixAutoUpdate; // for better performance
      line.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
      return line;
    };

    const lines: THREE.LineSegments[] = [];
    if (obj instanceof THREE.InstancedMesh) {
      for (let i = 0; i < obj.count; ++i) {
        const m = new THREE.Matrix4();
        obj.getMatrixAt(i, m);
        const line = createOutline(obj.geometry, m);
        // line.position.set(obj.position.x, obj.position.y, obj.position.z)
        if (options.replaceOriginalObject && obj.parent) {
          const parent = obj.parent;
          parent.children.push(line);
        } else {
          obj.children.push(line);
        }
        lines.push(line);
      }
    } else {
      // create outline and add it as a child
      const line = createOutline(obj.geometry, obj.matrix);
      // line.position.set(obj.position.x, obj.position.y, obj.position.z)
      if (options.replaceOriginalObject && obj.parent) {
        // In this case, we'll remove the object. Which means, user cann't get it back!
        // parent.remove(obj)
        obj.removeFromParent(); // removeFromParent is added from r129
        obj.geometry.dispose(); // TODO: consider to dispose unused materials too
        const parent = obj.parent;
        parent.children.push(line);
      } else {
        obj.children.push(line);
      }
      lines.push(line);
    }
    return lines;
  }

  /**
   * Recursively removes outlines for given object and children
   */
  public static removeOutlines(object: THREE.Object3D) {
    if (!object || !Array.isArray(object.children)) {
      return;
    }
    for (let i = object.children.length - 1; i >= 0; --i) { // iterate from back to front
      const child = object.children[i];
      if (child.children.length > 0) {
        this.removeOutlines(child);
      }
      if (child.userData.isOutline) {
        object.remove(child);
      }
    }
  }

  /**
   * Recursively checks if an object or children has outline already
   */
  public static hasOutline(object: THREE.Object3D): boolean {
    let result = false;
    for (let i = 0; i < object.children.length; ++i) {
      const obj = object.children[i];
      if (obj.userData.isOutline) {
        result = true;
        break;
      }
      if (obj.children.length > 0) {
        result = this.hasOutline(obj);
        if (result) {
          break;
        }
      }
    }
    return result;
  }

  /**
   * Sets outline visiblility for given object and children
   */
  public static setOutlinesVisibility(object: THREE.Object3D, visible: boolean) {
    object.traverse(obj => {
      if (obj.userData.isOutline) {
        obj.visible = visible;
      }
    });
  }
}
