import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";
import { matrixAutoUpdate } from "@/core/Constants";
import GeometryUtils from "../utils/GeometryUtils";
import MaterialUtils from "../utils/MaterialUtils";

/**
 * MergeHelper class is used to merge child objects for a given object
 */
export default class MergeHelper {
  object: THREE.Object3D
  counter = 0 // used to avoid printing too many logs

  constructor(object: THREE.Object3D) {
    this.object = object;
  }

  /**
   * Merges child objects for given object.
   * @param deepMerge with deepMerge to be false, it tries to merge objects in the same level and with the same parent;
   *   with deepMerge to be true, it tries to merge across all levels in the entire root object;
   */
  public merge(deepMerge = true) {
    this.counter = 0;
    const startTime = Date.now();
    this.mergeInner(this.object);
    if (deepMerge) {
      this.deepMerge(this.object);
    }
    console.log(`[Merge] merge() costed ${(Date.now() - startTime) / 1000}s`);
  }

  /**
   * Merges child objects of given object.
   * If objects' material are the same, they can be merged.
   */
  private mergeInner(object: THREE.Object3D) {
    if (!object.children || object.children.length === 0) {
      return;
    }
    const childCount = object.children.length;

    // to group the index that can be merged. e.g. {0: { indexes: [0, 3, 4]}}
    // means 0, 3, 4 have the same material can be merged
    const dict: { [firstIndex: number]: { indexes: number[] } } = {};
    // store indexes of objects that are able to but didn't find the same material yet.
    // nonInstIndexes is used in order to improve performance (space for time), with this, it can check less objects.
    const nonMergeIndexes: number[] = [];
    for (let i = 0; i < childCount; ++i) {
      const oi = object.children[i] as THREE.Mesh; // object i
      // recursive call, depth-first, handle descendants first
      this.mergeInner(oi);

      if (oi.children && oi.children.length > 0) continue; // only merge leaf nodes, skip parent nodes
      if (!oi.geometry) continue; // skit any one without geometry

      let foundMergeableObject = false;
      // for a better hit rate(performance), firstly find out if there is the same geometry and material in the dict
      const values = Object.values(dict);
      for (let j = values.length - 1; j >= 0; --j) { // search from back to front for a better hit rate
        const k = values[j].indexes[0];
        foundMergeableObject = this.tryHandleMergeableObjects(object, i, k, dict, nonMergeIndexes);
        if (foundMergeableObject) {
          break;
        }
      }

      for (let j = nonMergeIndexes.length - 1; !foundMergeableObject && j >= 0; --j) {
        const k = nonMergeIndexes[j];
        foundMergeableObject = this.tryHandleMergeableObjects(object, i, k, dict, nonMergeIndexes);
        if (foundMergeableObject) {
          break;
        }
      }
      if (!foundMergeableObject) {
        nonMergeIndexes.push(i);
      }
    }
    if (Object.keys(dict).length <= 0) {
      return;
    }
    // console.log(dict)

    // creates new merged geometries
    const mergedMeshes: THREE.Mesh[] = [];
    const indexesToBeRemoved: number[] = []; // store all indexes to be removed later
    Object.values(dict).forEach((value: any) => {
      const indexes = value.indexes;
      const firstObj = object.children[indexes[0]] as THREE.Mesh;
      let geometries: THREE.BufferGeometry[] = [];
      indexes.forEach((index: number) => {
        const obj = object.children[index];
        if (obj instanceof THREE.Mesh) {
          const geom = obj.geometry.clone(); // need to clone geometry, bacause a geometry can be shared by many objects
          GeometryUtils.tryConvertInterleavedBufferAttributes(geom);
          geom.applyMatrix4(obj.matrix);
          geometries.push(geom);
          indexesToBeRemoved.push(index);
        }
      });
      if (geometries.length > 0) {
        const mergedBufferGeometry = BufferGeometryUtils.mergeBufferGeometries(geometries);
        geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose()); // dispose as soon as posibble
        geometries = [];
        const mergedMesh = new THREE.Mesh(mergedBufferGeometry, firstObj.material);
        mergedMesh.name = `[Merged] ${firstObj.name}`; // for now, used the first object's name
        mergedMesh.userData.selectable = false; // set selectable to false because it doesn't make sense to select merged object
        mergedMesh.matrixAutoUpdate = matrixAutoUpdate;
        if (!matrixAutoUpdate) {
          mergedMesh.updateMatrix();
        }
        mergedMesh.updateMatrixWorld(true);
        mergedMesh.updateWorldMatrix(true, true);
        mergedMeshes.push(mergedMesh);
      }
    });

    // remove original objects
    indexesToBeRemoved.sort((a, b) => b - a); // need to delete from back to front, order descending
    indexesToBeRemoved.forEach(i => {
      const o = object.children[i];
      object.remove(o);
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });

    // add new meshes
    mergedMeshes.forEach(mesh => {
      // object.children.push() has better performance than object.add(), because the former didn't dispatch event, etc.
      mesh.parent = object;
      object.children.push(mesh);
    });
    object.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
    if (this.counter++ < 2) {
      console.log(`[Merge] ${indexesToBeRemoved.length}(out of ${childCount}) objects merged to ${mergedMeshes.length} Meshes`);
    } else {
      console.log(`[Merge] ${indexesToBeRemoved.length}/${childCount} -> ${mergedMeshes.length}`);
    }
  }

  /**
   * @param object parent object
   * @param i index of for object.children[]
   * @param k index of for object.children[]
   * @param dict to store merge-able object
   * @param nonMergeIndexes used in order to improve performance
   */
  private tryHandleMergeableObjects(object: THREE.Object3D, i: number, k: number, dict: { [firstIndex: number]: { indexes: number[]; } }, nonMergeIndexes: number[]) {
    // if materials are the same, then they can be merged
    let foundMergeableObject = false;
    const oi = object.children[i] as THREE.Mesh;
    const ok = object.children[k] as THREE.Mesh;
    if (MaterialUtils.materialsEquals(oi.material, ok.material)) { // call MaterialUtils.materialsEquals() only for deep merge
      if (!dict[k]) {
        dict[k] = { indexes: [k] };
        this.removeFromArray(nonMergeIndexes, k);
      }
      dict[k].indexes.push(i);
      foundMergeableObject = true;
    }
    return foundMergeableObject;
  }

  /**
   * Merges all objects of given object, not just direct children but also descendants (across all levels).
   * If objects' material are the same, they can be merged.
   * Better to call mergeInner first then deepMerge for a better performance.
   */
  private deepMerge(object: THREE.Object3D) {
    // to group the objects that can be merged. e.g. {objectId0: { objects: [object0, object2, object8]}}
    // means object0, object2, object8 have the same material can be merged.
    // Here we store Object3D rather than id, because it is faster when there are many objects.
    const dict: { [firstObjectId: number]: { material: any, objects: THREE.Object3D[] } } = {};
    // firstly traverse all objects to find mergeable ones
    let totalCount = 0;
    object.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh) || !obj.geometry || !obj.material) {
        return;
      }
      GeometryUtils.tryConvertInterleavedBufferAttributes(obj.geometry); // try handle InterleavedBufferAttributes
      let foundMergeableObject = false;
      const values = Object.values(dict);
      for (let i = values.length - 1; i >= 0; --i) { // search from back to front for a better hit rate
        if (MaterialUtils.materialsEquals(values[i].material, obj.material)) {
          values[i].objects.push(obj);
          foundMergeableObject = true;
          break;
        }
      }
      if (!foundMergeableObject) {
        dict[obj.id] = { material: obj.material, objects: [obj]/* , geometries: [obj.geometry.clone()] */ };
      }
      totalCount++;
    });

    // since we'll move geometry to another merged mesh under a group, below is the structure:
    // - root object
    //  - merged objects group
    //    - merged object 1
    // need to consider a geomery's matrix for each level of ancestor
    const applyMatrix = (geom: THREE.BufferGeometry, obj: THREE.Object3D): THREE.BufferGeometry => {
      geom.applyMatrix4(obj.matrix);
      if (obj.parent && obj.parent !== object) { // also apply matrix of parent, until reached 'object'
        applyMatrix(geom, obj.parent);
      }
      return geom;
    };

    // create merged meshes
    const group = new THREE.Group();
    const values = Object.values(dict).filter(value => value.objects.length > 1); // only merge when a material is used by more than 1 ojbects
    group.name = `Merged objects (${values.length})`;
    for (let i = values.length - 1; i >= 0; --i) { // search from back to front for a better hit rate
      const value = values[i];
      let geometries: THREE.BufferGeometry[] = [];
      for (let j = 0; j < value.objects.length; ++j) {
        const obj = value.objects[j];
        const geom = applyMatrix((obj as THREE.Mesh).geometry.clone(), obj); // need to clone geometry, bacause a geometry can be shared by many objects
        geometries.push(geom);
      }
      const geom = BufferGeometryUtils.mergeBufferGeometries(geometries);
      geometries.forEach((geom: THREE.BufferGeometry) => geom.dispose()); // dispose as soon as posibble
      geometries = [];
      if (geom) {
        const mergedMesh = new THREE.Mesh(geom, value.material);
        mergedMesh.name = `[Merged] ${value.material.name}`; // for now, used the first object's name
        mergedMesh.userData.selectable = false; // set selectable to false because it doesn't make sense to select merged object
        mergedMesh.matrixAutoUpdate = matrixAutoUpdate;
        if (!matrixAutoUpdate) {
          mergedMesh.updateMatrix();
        }
        mergedMesh.parent = group;
        group.children.push(mergedMesh);
      } else {
        // It could fail to merge because of InterleavedBufferAttributes, position, etc.
        // In this case, cleanup the ids, so it won't remove these objects
        value.objects = [];
      }
    }

    // delete original meshes
    let removedCount = 0;
    for (let i = values.length - 1; i >= 0; --i) { // search from back to front for a better hit rate
      values[i].objects.forEach(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.removeFromParent(); // removeFromParent is added from r129
          obj.geometry.dispose();
          removedCount++;
        }
      });
      values[i].objects = [];
    }

    if (group.children.length) {
      group.matrixAutoUpdate = matrixAutoUpdate;
      if (!matrixAutoUpdate) {
        group.updateMatrix();
      }
      group.parent = object;
      object.children.push(group);
    }
    console.log(`[Merge] ${removedCount}(out of ${totalCount}) objects merged to ${group.children.length} Meshes during deepMerge`);
  }

  /**
   * Removes a number from array
   */
  removeFromArray(arr: number[], toBeRemoved: number) {
    for (let i = arr.length - 1; i >= 0; --i) { // do from back to front for a better hit rate
      if (arr[i] === toBeRemoved) {
        arr.splice(i, 1);
        return;
      }
    }
  }
}
