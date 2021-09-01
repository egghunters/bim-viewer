import * as THREE from "three";

export default class CoordinateAxes extends THREE.Object3D {
  name = "COORDINATE_AXES"
  private readonly AXIS_LENGTH = 1
  // follows right-hand coordinate system
  private readonly AXIS_COLOR_X = 0xff0000 // red
  private readonly AXIS_COLOR_Y = 0x00ff00 // green
  private readonly AXIS_COLOR_Z = 0x0000ff // blue

  constructor(addTexts = true) {
    super();

    const origin = new THREE.Vector3(0, 0, 0);
    const axisX = new THREE.Vector3(1, 0, 0);
    const axisY = new THREE.Vector3(0, 1, 0);
    const axisZ = new THREE.Vector3(0, 0, 1);

    const arrowX = new THREE.ArrowHelper(axisX, origin, this.AXIS_LENGTH, this.AXIS_COLOR_X, this.AXIS_LENGTH / 5, this.AXIS_LENGTH / 8);
    const arrowY = new THREE.ArrowHelper(axisY, origin, this.AXIS_LENGTH, this.AXIS_COLOR_Y, this.AXIS_LENGTH / 5, this.AXIS_LENGTH / 8);
    const arrowZ = new THREE.ArrowHelper(axisZ, origin, this.AXIS_LENGTH, this.AXIS_COLOR_Z, this.AXIS_LENGTH / 5, this.AXIS_LENGTH / 8);
    this.add(arrowX, arrowY, arrowZ);

    // an additional box at the origin
    // const sphere = new THREE.SphereGeometry(this.AXIS_LENGTH / 20)
    // const object = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffff00 }))
    // const box = new THREE.BoxHelper(object, 0xffff00)
    // this.add(box)

    addTexts && this.addTexts();
  }

  addTexts() {
    // should be able to load font from threejs' folder, don't know how...
    new THREE.FontLoader().load("three/fonts/helvetiker_regular.typeface.json", (font) => {
      const x = this.createText(font, "x", new THREE.Color(0xff0000));
      const y = this.createText(font, "y", new THREE.Color(0x00ff00));
      const z = this.createText(font, "z", new THREE.Color(0x0000ff));
      x.position.set(this.AXIS_LENGTH, 0, 0);
      y.position.set(0, this.AXIS_LENGTH, 0);
      z.position.set(0, 0, this.AXIS_LENGTH);
      this.add(x, y, z);
    });
  }

  createText(font: THREE.Font, text: string, color?: THREE.Color) {
    const textGeom = new THREE.TextGeometry(text, {
      font: font,
      size: 0.3,
      height: 0.02,
      curveSegments: 6,
      bevelEnabled: false,
      bevelThickness: 0,
      bevelSize: 0.01,
      bevelSegments: 3
    });
    const textMat = new THREE.MeshStandardMaterial({
      flatShading: true,
      transparent: true,
      opacity: 0.6,
      emissive: color || new THREE.Color(0x00ff00)
    });
    return new THREE.Mesh(textGeom, textMat);
  }
}
