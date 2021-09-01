/**
 * This class implemented setTimeout and setInterval using RequestAnimationFrame
 * This code references to
 * https://github.com/aisriver/myHome3D/blob/master/src/utils/RAF.ts
 */
export default class RafHelper {
  readonly TIMEOUT = "timeout"
  readonly INTERVAL = "interval"
  private timeoutMap: any = {} // timeout map, key is symbol
  private intervalMap: any = {} // interval map

  private run(type = this.INTERVAL, cb: () => void, interval = 16.7) {
    const now = Date.now;
    let startTime = now();
    let endTime = startTime;
    const timerSymbol = Symbol("");
    const loop = () => {
      this.setIdMap(timerSymbol, type, loop);
      endTime = now();
      if (endTime - startTime >= interval) {
        if (type === this.intervalMap) {
          startTime = now();
          endTime = startTime;
        }
        cb();
        if (type === this.TIMEOUT) {
          this.clearTimeout(timerSymbol);
        }
      }
    };
    this.setIdMap(timerSymbol, type, loop);
    return timerSymbol;
  }

  private setIdMap(timerSymbol: symbol, type: string, loop: (time: number) => void) {
    const id = requestAnimationFrame(loop);
    if (type === this.INTERVAL) {
      this.intervalMap[timerSymbol] = id;
    } else if (type === this.TIMEOUT) {
      this.timeoutMap[timerSymbol] = id;
    }
  }

  public setTimeout(cb: () => void, interval: number) {
    return this.run(this.TIMEOUT, cb, interval);
  }

  public clearTimeout(timer: symbol) {
    cancelAnimationFrame(this.timeoutMap[timer]);
  }

  public setInterval(cb: () => void, interval: number) {
    return this.run(this.INTERVAL, cb, interval);
  }

  public clearInterval(timer: symbol) {
    cancelAnimationFrame(this.intervalMap[timer]);
  }
}
