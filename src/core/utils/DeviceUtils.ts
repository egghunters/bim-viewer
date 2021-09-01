/**
 * Device util class
 */
export default class DeviceUtils {
  /**
   * Checks if it is opened in touch screen device, like iphone, ipad, etc.
   */
  static isTouchScreenDevice(): boolean {
    // return !!("ontouchstart" in window || navigator.maxTouchPoints);
    return !!("ontouchstart" in window);
  }

  static printDeviceInfo() {
    const ua = navigator.userAgent;
    const isAndroid = /(?:Android)/.test(ua);
    const isFireFox = /(?:Firefox)/.test(ua);
    const isChrome = /(?:Chrome|CriOS)/.test(ua);
    const isTablet = /(?:iPad|PlayBook)/.test(ua) || (isAndroid && !/(?:Mobile)/.test(ua)) || (isFireFox && /(?:Tablet)/.test(ua));
    const isiPhone = /(?:iPhone)/.test(ua) && !isTablet;
    const isPc = !isiPhone && !isAndroid;
    const isTouchDevice = DeviceUtils.isTouchScreenDevice();
    if (isAndroid) console.log("[DI] is android");
    if (isFireFox) console.log("[DI] is fireFox");
    if (isChrome) console.log("[DI] is chrome");
    if (isTablet) console.log("[DI] is tablet");
    if (isiPhone) console.log("[DI] is iPhone");
    if (isPc) console.log("[DI] is PC");
    if (isTouchDevice) console.log("[DI] is touch device");
  }

  /**
   * Gets GPU Graphics card info
   * @param canvas
   */
  static getWebGlRendererInfo(canvas: HTMLCanvasElement): string {
    if (!canvas) {
      throw new Error("Invalid canvas!");
    }
    // Please find more details about getContext() via this link:
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
    const webgl: any = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") || canvas.getContext("webgl2");
    const info = webgl && webgl.getExtension("WEBGL_debug_renderer_info");
    let glRenderer = "unknown";
    if (info) {
      glRenderer = webgl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    }
    return glRenderer;
  }
}
