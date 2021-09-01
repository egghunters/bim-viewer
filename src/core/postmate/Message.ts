/**
 * Message Id that is sent from parent app to threejs viewer
 */
export enum MessageId {
  /* postmate properties, which returns value to caller */
  getSupportedPostmateProperties = "getSupportedPostmateProperties", // message for postmate itself
  getSupportedPostmateFunctions = "getSupportedPostmateFunctions", // message for postmate itself
  getGroundGrid = "getGroundGrid",

  /* postmate messages/functions, which don't returns anything to caller */
  setBimTree = "setBimTree",
  setGroundGrid = "setGroundGrid",
  goHomeView = "goHomeView",
  setTransparentMode = "setTransparentMode",
  setExplodeMode = "setExplodeMode",
  highlightRandomNode = "highlightRandomNode",
  setObjectsPlaneClipper = "setObjectsClipPlane", // input param: boolean
  setObjectsBoxClipper = "setObjectsClipBox" // input param: boolean
}

/**
 * Message format, that is transfered between threejs viewer and parents
 */
export interface Message {
  messageId: string;
  time?: string; // time stamp
  messageData?: object | BooleanMessageData;
}

/**
 * Message data for true/false cases
 */
export interface BooleanMessageData {
  value: boolean;
}
