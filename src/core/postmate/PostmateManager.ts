import { MessageId } from "../postmate/Message";

const PM = require("postmate");

export interface History {
  direction: "sent" | "received",
  type: "property" | "function",
  messageId: string,
  time: number
}

/**
 * Util methods for PostMessage
 * https://github.com/dollarshaveclub/postmate
 */
export class PostmateManager {
  isEmbedded = false
  childApi: any
  // stores all properties and functions
  model: { [property: string]: any } = {}
  // the different between property and function is that
  // - property has return value, ParentAPI should call ParentAPI.get(property) to get a Promise
  // - function doesn't return anything, ParentAPI should call ParentAPI.call(property, data)
  properties: string[] = [] // store all properties
  functions: string[] = [] // store all functions
  // store sent/received message history
  histories: History[] = []

  /**
   * Singleton design pattern
   */
  private static _instance: PostmateManager | undefined = undefined
  public static instance(): PostmateManager {
    if (!PostmateManager._instance) {
      PostmateManager._instance = new PostmateManager();
      PostmateManager._instance.init();
    }
    return PostmateManager._instance;
  }

  /**
   * Initialize postmate
   */
  private init() {
    // found out if 'this' page is embedded in an iframe
    const isEmbedded = (window.location !== window.parent.location);
    this.isEmbedded = isEmbedded;
    // if not embedded, then not necessary to receive message
    if (!isEmbedded) {
      return;
    }
    console.log(`[PM] BIM Viewer is${isEmbedded ? "" : " not"} embedded`);

    const Postmate = PM.default;
    // Postmate.debug = true
    const handshake = new Postmate.Model(this.model);
    // When parent <-> child handshake is complete, events may be emitted to the parent
    handshake.then((childApi: any) => {
      this.childApi = childApi;
    });

    // register two messages for postmate, so parent knows what properties and functions it can get() and call()
    this.addEventListenerWithReturnValue(MessageId.getSupportedPostmateProperties, () => this.properties);
    this.addEventListenerWithReturnValue(MessageId.getSupportedPostmateFunctions, () => this.functions);
  }

  /**
   * To indicate if 'this' page is embedded into an iframe
   */
  public getIsEmbedded(): boolean {
    return this.isEmbedded;
  }

  /**
   * Emits message from child(inner iframe) to parent
   * @param messageId should be defined in parent
   * @param message should be defined and parsed in parent
   */
  public emit(messageId: string, data: any) {
    if (this.childApi) {
      this.childApi.emit(messageId, data);
    }
  }

  /**
   * Simply calls childApi.get()
   * @param property property name
   */
  public get(property: string) {
    if (this.childApi) {
      return this.childApi.get(property);
    }
  }

  /**
   * Simply calls childApi.call()
   * @param property property name
   * @param data data object
   */
  public call(property: string, data: any) {
    if (this.childApi) {
      this.childApi.call(property, data);
    }
  }

  /**
   * Registers a property to postmate model, so parent can call parentApi.call('property', data),
   * then, postmate returns a Promise.
   * @param property aka, message id
   * @param value value or function
   */
  public addEventListener(property: MessageId, callback: (messageData: object) => void) {
    if (!this.isEmbedded) {
      return; // do nothing if not embedded
    }
    // wrap the callback, so we know
    this.model[property] = (messageData: object) => {
      this.histories.push({ direction: "received", type: "function", messageId: property, time: Date.now() });
      callback(messageData);
    };
    this.functions.push(property);
  }

  /**
   * Registers a property to postmate model, so parent can call parentApi.get('property'),
   * then, postmate returns a Promise.
   * @param property a string
   * @param value value or function
   */
  public addEventListenerWithReturnValue(property: MessageId, callback: (messageData: object) => void) {
    if (!this.isEmbedded) {
      return; // do nothing if not embedded
    }
    this.model[property] = (messageData: object) => {
      this.histories.push({ direction: "received", type: "property", messageId: property, time: Date.now() });
      return callback(messageData);
    };
    this.properties.push(property);
  }

  /**
   * Removes a property to postmate model,
   * then, postmate returns a Promise.
   * @param property aka, message id
   */
  public removeEventListener(...properties: MessageId[]) {
    properties.forEach(property => {
      if (this.model[property]) {
        delete this.model[property];
      }
      const i = this.functions.indexOf(property);
      if (i >= 0) {
        this.functions.splice(i, 1);
      }
    });
  }

  /**
   * Removes a property to postmate model,
   * then, postmate returns a Promise.
   * @param property a string
   */
  public removeEventListenerWithReturnValue(...properties: MessageId[]) {
    properties.forEach(property => {
      if (this.model[property]) {
        delete this.model[property];
      }
      const i = this.properties.indexOf(property);
      if (i >= 0) {
        this.properties.splice(i, 1);
      }
    });
  }

  /**
   * Gets postmate histories
   */
  public getHistories(): History[] {
    return this.histories;
  }
}
