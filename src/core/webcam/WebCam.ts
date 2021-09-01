import * as THREE from "three";

// Reference to https://sbcode.net/threejs/webcam/
// This class is just a demo yet
export class WebCam {
  private webcamCanvas: HTMLCanvasElement
  private webcam: HTMLVideoElement
  private canvasCtx: CanvasRenderingContext2D
  private webcamTexture: THREE.Texture
  private shaderMaterial: THREE.ShaderMaterial

  readonly vertexShader = `
    varying vec2 vUv;
    void main( void ) {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`

  readonly fragmentShader = `
    uniform vec3 keyColor;
    uniform float similarity;
    uniform float smoothness;
    varying vec2 vUv;
    uniform sampler2D map;
    void main() {
        vec4 videoColor = texture2D(map, vUv);

        float Y1 = 0.299 * keyColor.r + 0.587 * keyColor.g + 0.114 * keyColor.b;
        float Cr1 = keyColor.r - Y1;
        float Cb1 = keyColor.b - Y1;
        
        float Y2 = 0.299 * videoColor.r + 0.587 * videoColor.g + 0.114 * videoColor.b;
        float Cr2 = videoColor.r - Y2; 
        float Cb2 = videoColor.b - Y2; 
        
        float blend = smoothstep(similarity, similarity + smoothness, distance(vec2(Cr2, Cb2), vec2(Cr1, Cb1)));
        gl_FragColor = vec4(videoColor.rgb, videoColor.a * blend); 
    }`

  constructor() {
    const webcam = document.createElement("video");
    this.webcam = webcam;
    const constraints = { video: { width: 600, height: 400 } };
    navigator.mediaDevices.getUserMedia(constraints).then((mediaStream: MediaStream) => {
      webcam.srcObject = mediaStream;
      webcam.onloadedmetadata = (e) => {
        webcam.setAttribute("autoplay", "true");
        webcam.setAttribute("playsinline", "true");
        webcam.play();
      };
    }).catch(function(err) {
      alert(err.name + ": " + err.message);
    });
    this.webcamCanvas = document.createElement("canvas");
    const canvasCtx = this.webcamCanvas.getContext("2d") as CanvasRenderingContext2D;
    this.canvasCtx = canvasCtx;
    canvasCtx.fillStyle = "#000000";
    canvasCtx.fillRect(0, 0, this.webcamCanvas.width, this.webcamCanvas.height);
    const webcamTexture = new THREE.Texture(this.webcamCanvas);
    this.webcamTexture = webcamTexture;
    webcamTexture.minFilter = THREE.LinearFilter;
    webcamTexture.magFilter = THREE.LinearFilter;
    this.shaderMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        map: { value: webcamTexture },
        keyColor: { value: [0.0, 1.0, 0.0] },
        similarity: { value: 0.3 },
        smoothness: { value: 0.0 }
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader
    });
  }

  /**
   * Returns THREE.ShaderMaterial that can be used for PlaneGeometry, Mesh, etc.
   */
  getShaderMaterial() {
    return this.shaderMaterial;
  }

  /**
   * Creates a plane to display webcam stream
   */
  createWebCamPlane(width = 5, height = 4): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, height);
    return new THREE.Mesh(geometry, this.shaderMaterial);
  }

  /**
   * This should be called in renderer's animate method
   */
  animate() {
    if (this.webcam.readyState === this.webcam.HAVE_ENOUGH_DATA) {
      this.canvasCtx.drawImage(this.webcam, 0, 0, this.webcamCanvas.width, this.webcamCanvas.height);
      this.webcamTexture.needsUpdate = true;
    }
  }
}
