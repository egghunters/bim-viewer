/* eslint-disable */
import * as THREE from "three"
import { BitView } from "./BitView"
import { SHP } from "./Shp"

/**
 * Three.js extensions for SHP parser.
 * Code is converted from JS to TS based on: https://github.com/kig/shp.js/
 */
export class ShpThree {
  readonly LINE_MATERIAL = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, opacity: 0.8, transparent: true })
  readonly MESH_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x1D65FF, opacity: 0.8, transparent: true }) // just one side for now

  /**
   * 
   * @param shp 
   * @param spherize is spherize or not. This only works well for the sameple shp for now!
   */
  public createModel (shp: any): THREE.Object3D {
    var polygons: any = []
    var lines = []
    for (var i = 0; i < shp.records.length; i++) {
      var r = shp.records[i].shape
      if (r.type === SHP.POLYLINE || r.type === SHP.POLYGON) {
        var points = r.content.points
        var parts = r.content.parts
        for (var k=0; k<parts.length; k++) {
          const poly = []
          for (var j=parts[k], last=parts[k+1]||(points.length/2); j<last; j++) {
            var x = points[j*2]
            var y = points[j*2+1]
            poly.push(new THREE.Vector3(x, y, 0))
          }
          if (r.type === SHP.POLYGON) {
            // create polygon with border
            // poly.pop() // pop out the last point
            // const vector2List = poly.map(v => new THREE.Vector2(v.x, v.y))
            // polygons.push(new THREE.ExtrudeGeometry(new THREE.Shape(vector2List), { depth: 1, bevelEnabled: false, curveSegments: 1 }))
            const trangles: number[][] = THREE.ShapeUtils.triangulateShape(poly, [])
            const index: number[] = []
            trangles.forEach(t => index.push(...t))
            const geom = new THREE.BufferGeometry()
            geom.setFromPoints(poly)
            geom.setIndex(index)
            polygons.push(geom)
            // create border
            const lineGeom = new THREE.BufferGeometry()
            if (poly.length > 2 && !poly[0].equals(poly[poly.length - 1])) {
              // close the line if not closed yet
              poly.push(poly[0])
            }
            lineGeom.setFromPoints(poly)
            lines.push(lineGeom)
          } else {
            // create line
            const geom = new THREE.BufferGeometry()
            geom.setFromPoints(poly)
            lines.push(geom)
          }
        }
      }
    }
    var model = new THREE.Object3D()
    for (var i=0; i<lines.length; i++) {
      model.add(new THREE.Line(lines[i], this.LINE_MATERIAL))
    }
    for (var i=0; i<polygons.length; i++) {
      model.add(new THREE.Mesh(polygons[i], this.MESH_MATERIAL))
    }
    console.log("parsed", polygons.length, lines.length)
    return model
  }

  loadCompressed (deltaEncoded: any) {
    var compressed = this.deltaDecode6(deltaEncoded)
    var polygons = []
    var lines: any = []
    for (var i=0; i<compressed.length; i++) {
      let poly: any = []
      if (compressed[i] === -32768) {
        var p: any = []
        for (var h=1; h<poly.length; h++) {
          if (!(poly[h-1].x == poly[h].x && poly[h-1].y == poly[h].y)) {
            p.push(poly[h])
          }
        }
        // TODO: check if this change is right
        // var shape = new THREE.Shape(p)
        // var geom = shape.extrude({ amount: 0.001, bevelThickness: 0.001, bevelSize: 0.001, bevelEnabled: false, curveSegments: 1 })
        const geom = new THREE.BufferGeometry()
        geom.setFromPoints(p)
        polygons.push(geom)
        poly = []
        continue
      }
      var x = compressed[i] * 180 / 32767
      var y = compressed[i+1] * 180 / 32767
      i++
      poly.push(new THREE.Vector3(x, y, 0))
    }
    var model = new THREE.Object3D()
    for (var i=0; i<lines.length; i++) {
      model.add(new THREE.Line(lines[i], this.LINE_MATERIAL))
    }
    for (var i=0; i<polygons.length; i++) {
      model.add(new THREE.Mesh(polygons[i], this.MESH_MATERIAL))
    }
    console.log("parsed compressed", polygons.length, lines.length)
    return model
  }

  compress (shp: any) {
    var polys = []
    for (var i=0; i<shp.records.length; i++) {
      var r = shp.records[i].shape
      if (r.type === SHP.POLYGON) {
        var points = r.content.points
        var parts = r.content.parts
        for (var k=0; k<parts.length; k++) {
          for (var j=parts[k], last=parts[k+1]||(points.length/2); j<last; j++) {
            var x = points[j*2]
            var y = points[j*2+1]
            polys.push(x / 180 * 32767, y / 180 * 32767)
          }
          polys.push(-32768)
        }
      }
    }
    var i16a = new Int16Array(polys)
    console.log("16-bit quantized byteLength", i16a.buffer.byteLength)
    var denc = this.deltaEncode6(i16a)
    console.log("delta-encoded byteLength", denc.byteLength)
    return denc
  }

  deltaEncode (arr: any) {
    var polys = []
    var spans = []
    var span = []
    var x = 0, y = 0
    var byteLen = 0
    for (var i=0; i<arr.length; i++) {
      if (arr[i] == -32768) {
        spans.push(span)
        polys.push(spans)
        spans = []
        span = []
        byteLen += 3
        continue
      }
      if (span.length == 0) {
        x = arr[i], y = arr[i+1]
        span.push(x, y)
        byteLen += 4
        i++
      } else if (Math.abs(x - arr[i]) > 1023 || Math.abs(y - arr[i+1]) > 1023) {
        spans.push(span)
        byteLen += 1
        span = []
        x = arr[i], y = arr[i+1]
        span.push(x, y)
        byteLen += 4
        i++
      } else {
        span.push((arr[i] - x) / 8, (arr[i+1] - y) / 8)
        x += (((arr[i] - x) / 8) | 0) * 8
        y += (((arr[i+1] - y) / 8) | 0) * 8
        byteLen += 2
        i++
      }
    }
    return this.storeDeltas(byteLen, polys)
  }

  deltaEncode6 (arr: any) {
    var polys = []
    var spans = []
    var span = []
    var x = 0, y = 0, i=0
    var byteLen = 0
    for (i=0; i<arr.length; i++) {
      arr[i] = 0 | (arr[i] / 16)
    }
    for (i=0; i<arr.length; i++) {
      if (arr[i] === -2048) {
        spans.push(span)
        polys.push(spans)
        spans = []
        span = []
        byteLen += 3
        continue
      }
      if (span.length == 0) {
        x = arr[i], y = arr[i+1]
        span.push(x, y)
        byteLen += 4
        i++
      } else if (Math.abs(x - arr[i]) > 31 || Math.abs(y - arr[i+1]) > 31) {
        spans.push(span)
        byteLen += 1
        span = []
        x = arr[i], y = arr[i+1]
        span.push(x, y)
        byteLen += 4
        i++
      } else {
        span.push((arr[i] - x), (arr[i+1] - y))
        x += (arr[i] - x)
        y += (arr[i+1] - y)
        byteLen += 2
        i++
      }
    }
    return this.storeDeltas6(byteLen, polys)
  }

  storeDeltas (byteLen: any, polys: any) { 
    var buf = new ArrayBuffer(byteLen)
    var dv = new DataView(buf)
    var idx = 0
    for (var i=0; i<polys.length; i++) {
      var spans = polys[i]
      for (var j=0; j<spans.length; j++) {
        var span = spans[j]
        dv.setInt16(idx, span[0])
        idx += 2
        dv.setInt16(idx, span[1])
        idx += 2
        for (var k=2; k<span.length; k++) {
          dv.setInt8(idx++, span[k])
        }
        dv.setInt8(idx, -128)
        idx += 1
      }
      dv.setInt16(idx, -32768)
      idx += 2
    }
    return buf
  }

  deltaDecode (buf: any) {
    var dv = new DataView(buf)
    var idx = 0
    var polys = []
    while (idx < buf.byteLength) {
      var x = dv.getInt16(idx)
      idx += 2
      if (x === -32768) {
        polys.push(-32768)
        continue
      }
      var y = dv.getInt16(idx)
      idx += 2
      polys.push(x, y)
      while (idx < buf.byteLength) {
        var dx = dv.getInt8(idx)
        idx++
        if (dx == -128) {
          break
        }
        var dy = dv.getInt8(idx)
        idx++
        x += dx * 8
        y += dy * 8
        polys.push(x, y)
      }
    }
    return polys
  }


  storeDeltas6 (byteLen: any, polys: any) { 
    var buf = new ArrayBuffer(Math.ceil(byteLen * 0.75)+4)
    var dv = new BitView(buf)
    var idx = 32
    for (var i=0; i<polys.length; i++) {
      var spans = polys[i]
      for (var j=0; j<spans.length; j++) {
        var span = spans[j]
        dv.setInt12(idx, span[0])
        idx += 12
        dv.setInt12(idx, span[1])
        idx += 12
        for (var k = 2; k < span.length; k++) {
          dv.setInt6(idx, span[k])
          idx += 6
        }
        dv.setInt6(idx, -32)
        idx += 6
      }
      dv.setInt12(idx, -2048)
      idx += 12
    }
    new DataView(buf).setUint32(0, idx)
    return buf
  }

  deltaDecode6 (buf: any) {
    var bitLength = new DataView(buf).getUint32(0)
    var dv = new BitView(buf)
    var idx = 32
    var polys = []
    while (idx < bitLength) {
      var x = dv.getInt12(idx)
      idx += 12
      if (x === -2048) {
        polys.push(-2048)
        continue
      }
      var y = dv.getInt12(idx)
      idx += 12
      polys.push(x, y)
      while (idx < bitLength) {
        var dx = dv.getInt6(idx)
        idx += 6
        if (dx === -32) {
          break
        }
        var dy = dv.getInt6(idx)
        idx += 6
        x += dx
        y += dy
        polys.push(x, y)
      }
    }
    for (var i=0; i<polys.length; i++) {
      polys[i] *= 16
    }
    return polys
  }
}
