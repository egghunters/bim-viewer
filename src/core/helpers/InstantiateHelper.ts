import * as THREE from "three";
import { matrixAutoUpdate } from "@/core/Constants";
import GeometryUtils from "../utils/GeometryUtils";
import MaterialUtils from "../utils/MaterialUtils";

/**
 * InstantiateHelper class is used to instantiate child objects for a given object
 */
export default class InstantiateHelper {
  object: THREE.Object3D;

  constructor(object: THREE.Object3D) {
    this.object = object;
  }

  /**
   * Instatiates child objects for given object.
   */
  public instantiate() {
    const startTime = Date.now();
    this.instantiateInner(this.object);
    console.log(`[Inst] instantiate() costed ${(Date.now() - startTime) / 1000}s`);
  }

  /**
   * Instatiates child objects of given object.
   * If objects' geometry and material are the same, they can be instanced.
   */
  private instantiateInner(object: THREE.Object3D) {
    if (!object.children || object.children.length === 0) {
      return;
    }
    const childCount = object.children.length;

    // to group the index that can be instanced. e.g. {0: { indexes: [0, 3, 4]}}
    // means 0, 3, 4 have the same geometry and material can be instanced
    const dict: { [firstIndex: number]: { indexes: number[] } } = {};
    // store indexes of objects that are able to but didn't find the same geometry and material yet.
    // nonInstIndexes is used in order to improve performance (space for time), with this, it can check less objects.
    const nonInstIndexes: number[] = [];
    for (let i = 0; i < childCount; ++i) {
      const oi = object.children[i] as THREE.Mesh; // object i
      // recursive call, depth-first, handle descendants first
      this.instantiateInner(oi);

      if (oi.children && oi.children.length > 0) continue; // only instantiate leaf nodes, skip parent nodes
      if (!oi.geometry) continue; // skit any one without geometry

      let foundInstantableObject = false;
      // for a better hit rate(performance), firstly find out if there is the same geometry and material in the dict
      const values = Object.values(dict);
      for (let j = values.length - 1; j >= 0; --j) { // search from back to front for a better hit rate
        const k = values[j].indexes[0];
        const ok = object.children[k] as THREE.Mesh; // object k
        // if geometry and material are the same, then they can be instanced
        if (this.geometryEquals(oi.geometry, ok.geometry) && MaterialUtils.materialsEquals(oi.material, ok.material)) {
          if (!dict[k]) {
            dict[k] = { indexes: [k] };
            this.removeFromArray(nonInstIndexes, k);
          }
          dict[k].indexes.push(i);
          foundInstantableObject = true;
          break; // break, since already found the same instance
        }
      }

      for (let j = nonInstIndexes.length - 1; !foundInstantableObject && j >= 0; --j) {
        const k = nonInstIndexes[j];
        const ok = object.children[k] as THREE.Mesh; // object k
        // if geometry and material are the same, then they can be instanced
        if (this.geometryEquals(oi.geometry, ok.geometry) && MaterialUtils.materialsEquals(oi.material, ok.material)) {
          if (!dict[k]) {
            dict[k] = { indexes: [k] };
            this.removeFromArray(nonInstIndexes, k);
          }
          dict[k].indexes.push(i);
          foundInstantableObject = true;
          break; // break, since already found the same instance
        }
      }
      if (!foundInstantableObject) {
        nonInstIndexes.push(i);
      }
    }
    if (Object.keys(dict).length <= 0) {
      return;
    }
    // console.log(dict)

    // creates new instances
    const instances: THREE.InstancedMesh[] = [];
    const indexesToBeRemoved: number[] = []; // store all indexes to be removed later
    Object.values(dict).forEach((value: any) => {
      const indexes = value.indexes;
      indexesToBeRemoved.push(...indexes);
      const firstObj = object.children[indexes[0]] as THREE.Mesh;
      let mat = firstObj.material;
      if (mat instanceof THREE.Material) {
        mat = (mat as THREE.Material).clone();
      } else if (Array.isArray(mat)) {
        const arr: THREE.Material[] = [];
        mat.forEach(m => arr.push(m.clone()));
        mat = arr;
      }
      const instance = new THREE.InstancedMesh(firstObj.geometry, mat, indexes.length);
      instance.name = `[Instanced] ${firstObj.name}`; // for now, used the first object's name
      for (let i = 0; i < indexes.length; ++i) {
        const index = indexes[i];
        const obj = object.children[index];
        obj.updateMatrix(); // need to update the matrix, otherwise, it will be wrong for some models!
        instance.setMatrixAt(i, obj.matrix);
      }
      instance.matrixAutoUpdate = matrixAutoUpdate;
      if (!matrixAutoUpdate) {
        instance.updateMatrix();
      }
      instances.push(instance);
    });

    // remove original objects
    indexesToBeRemoved.sort((a, b) => b - a); // need to delete from back to front, order descending
    indexesToBeRemoved.forEach(i => object.remove(object.children[i]));

    // add new instances
    instances.forEach(instance => {
      // object.children.push() has better performance than object.add(), because the former didn't dispatch event, etc.
      instance.parent = object;
      object.children.push(instance);
    });
    object.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
    console.log(`[Inst] ${indexesToBeRemoved.length}(out of ${childCount}) objects instanced to ${instances.length} InstancedMesh`);
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

  /**
   * Checks if two geometries equal
   */
  private geometryEquals(g1: THREE.BufferGeometry, g2: THREE.BufferGeometry) {
    // return g1 === g2
    return GeometryUtils.geometryEquals(g1, g2);
  }
}
