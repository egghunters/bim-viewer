/**
 * To improve performance, we can set object.matrixAutoUpdate = false for static or rarely moving objects and
 * manually call object.updateMatrix() whenever their position/rotation/quaternion/scale are updated.
 * Add a constrant here, so developer can change it here easily for debugging.
 */
export const matrixAutoUpdate = false;
