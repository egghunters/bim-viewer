import * as THREE from "three";

/**
 * Exploder class is used to explode an object
 */
export default class Exploder {
  static DEFAULT_SCALE = 1;
  private scene: THREE.Scene;
  private objectId: number; // target object to be exploded
  public position: THREE.Vector3; // position of exploder
  private scale: number; // power of exploder, means how far will a sub-object exploded away
  private explodedTimes: number = 0; // an object can be exploded more than once
  private isExplodeUp: boolean = false; // only explode at y direction

  /**
   * Constructor of Explode
   * @param objectId target object id, that is going to be exploded
   * @param position if undefined, will explode object by its center
   * @param scale scale factor, 1 means 1 time farer away from exploder's position
   */
  public constructor(scene: THREE.Scene, objectId: number, position: THREE.Vector3 | undefined = undefined, scale: number = Exploder.DEFAULT_SCALE) {
    this.scene = scene;
    this.objectId = objectId;
    if (!objectId) {
      console.log(`[EXP] Invalid objectId: ${objectId}`);
    }
    this.scale = scale;
    if (scale <= 0) {
      console.log(`[EXP] Invalid scale: ${scale}`);
    }
    if (position) {
      this.position = position;
    } else {
      this.position = new THREE.Vector3();
      this.getObjectCenter(this.position);
    }
  }

  /**
   * Explode the object
   */
  public explode() {
    if (!this.objectId || !this.position || !this.scale) {
      console.log(`[EXP] Invalid objectId: ${this.objectId}, or position: ${this.position}, or this.power: ${this.scale}`);
      return;
    }
    const object = this.scene.getObjectById(this.objectId);
    if (!object || !object.children) {
      console.log("[EXP] No children to explode!");
      return;
    }
    console.log(`[EXP] Exploding ${object.name} at: ${this.position.x}, ${this.position.y}, ${this.position.z}`);
    object.children.forEach(childObj => {
      if (childObj instanceof THREE.InstancedMesh) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        for (let i = 0; i < childObj.count; ++i) {
          // gets position, update position, then set a new position
          childObj.getMatrixAt(i, matrix);
          matrix.decompose(pos, quaternion, scale);
          // console.log(`obj '${childObj.name}', [${i}] old position: (${pos.x}, ${pos.y}, ${pos.z})`)
          if (!this.isExplodeUp) {
            const distance = pos.clone().sub(this.position); // get distance from childObj to exploder position
            pos.addScaledVector(distance, this.scale);
          } else {
            const distance2 = (pos.z - this.position.z) * this.scale;
            pos.setZ(pos.z + distance2);
          }
          // console.log(`obj '${childObj.name}', [${i}] new position: (${pos.x}, ${pos.y}, ${pos.z})`)
          matrix.setPosition(pos);
          childObj.setMatrixAt(i, matrix);
        }
        childObj.matrixWorldNeedsUpdate = true; // not necessary?
        childObj.instanceMatrix.needsUpdate = true; // need to call this to upate it
      } else {
        const pos = childObj.position.clone();
        if (!this.isExplodeUp) {
          const distance = pos.sub(this.position); // get distance from childObj to exploder position
          childObj.position.addScaledVector(distance, this.scale);
          // if child has children, update their position too
          // childObj.children.forEach(o => o.position.addScaledVector(distance, this.scale))
        } else {
          const distance2 = (pos.z - this.position.z) * this.scale;
          childObj.position.setZ(pos.z + distance2);
        }
      }
      childObj.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
    });
    this.explodedTimes++;
  }

  /**
   * Unexplode the object
   */
  public unexplode() {
    const object = this.scene.getObjectById(this.objectId);
    if (!object || !object.children) {
      console.log("[EXP] No children to explode!");
      return;
    }
    console.log(`[EXP] Unexploding ${object.name} at: ${this.position.x}, ${this.position.y}, ${this.position.z}`);
    for (let i = this.explodedTimes; i > 0; --i) {
      object.children.forEach(childObj => {
        if (childObj instanceof THREE.InstancedMesh) {
          const matrix = new THREE.Matrix4();
          const pos = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          const factor = this.scale / (1 + this.scale);
          for (let i = 0; i < childObj.count; ++i) {
            // gets position, update position, then set a new position
            childObj.getMatrixAt(i, matrix);
            matrix.decompose(pos, quaternion, scale);
            // console.log(`obj '${childObj.name}', [${i}] old position: (${pos.x}, ${pos.y}, ${pos.z})`)
            if (!this.isExplodeUp) {
              const dist = pos.clone().sub(this.position); // need to use a cloned position here
              dist.x *= factor;
              dist.y *= factor;
              dist.z *= factor;
              pos.sub(dist);
            } else {
              const dist2 = (pos.z - this.position.z) * factor;
              pos.setZ(pos.z - dist2);
            }
            // console.log(`obj '${childObj.name}', [${i}] new position: (${pos.x}, ${pos.y}, ${pos.z})`)
            matrix.setPosition(pos);
            childObj.setMatrixAt(i, matrix);
          }
          childObj.matrixWorldNeedsUpdate = true; // not necessary?
          childObj.instanceMatrix.needsUpdate = true; // need to call this to upate it
        } else {
          const pos = childObj.position.clone();
          const factor = this.scale / (1 + this.scale);
          if (!this.isExplodeUp) {
            const dist = pos.sub(this.position);
            dist.x *= factor;
            dist.y *= factor;
            dist.z *= factor;
            childObj.position.sub(dist);
          } else {
            const dist2 = (pos.z - this.position.z) * factor;
            childObj.position.setZ(pos.z - dist2);
          }
        }
        childObj.updateMatrix(); // need to call it since object.matrixAutoUpdate is false
      });
    }
  }

  public setOnlyExplodeUp(onlyExplodeUp: boolean) {
    this.isExplodeUp = onlyExplodeUp;
  }

  private getObjectCenter(center: THREE.Vector3) {
    const bbox = new THREE.Box3();
    if (!this.objectId) {
      console.log(`[EXP] Invalid objectId: ${this.objectId}`);
      return;
    }
    const object = this.scene.getObjectById(this.objectId);
    if (!object || !object.children) {
      console.log("[EXP] No children to explode!");
      return;
    }
    object.traverse(obj => {
      bbox.expandByObject(obj);
    });
    bbox.getCenter(center);
  }
}
