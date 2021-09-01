import { Component, Vue, Emit } from "vue-property-decorator";
import { VNode } from "vue/types/umd";
import styles from "./BasePanel.module.scss";

/**
 * BasePanel class
 * BasePanel defines common layout and behavior for panel.
 * e.g. drag-able, resize-able, close-able, the same header/footer, etc.
 * All panel in this application should derive from BasePanel
 */
@Component
export default class BasePanel extends Vue {
  protected minWidth = 150;
  protected maxWidth = 600;
  protected minHeight = 200;
  protected maxHeight = 800;

  @Emit()
  protected close() {}

  @Emit()
  protected resize() {}

  protected mounted() {
  }

  /**
   * Handles drag event
   */
  protected dragHandler(e: MouseEvent) {
    const panel = this.$refs.basePanel as HTMLElement;
    const parentElement = this.findRelativeParentElement(panel);
    const distX = e.clientX - panel.offsetLeft;
    const distY = e.clientY - panel.offsetTop;
    if ((panel as any).setCapture) {
      (panel as any).setCapture();
    }

    document.onmousemove = function(e) {
      e.preventDefault();
      let l = e.clientX - distX; // left
      let t = e.clientY - distY; // top
      const pOffsetWidth = parentElement.offsetWidth;
      const pOffsetHeight = parentElement.offsetHeight;
      const elOffsetWidth = panel.offsetWidth;
      const elOffsetHeight = panel.offsetHeight;
      l = Math.min(Math.max(l, 0), pOffsetWidth - elOffsetWidth);
      t = Math.min(Math.max(t, 0), pOffsetHeight - elOffsetHeight);

      panel.style.left = l + "px";
      panel.style.top = t + "px";
    };
    document.onmouseup = function() {
      document.onmousemove = document.onmousedown = null;
      if ((panel as any).releaseCapture) {
        (panel as any).releaseCapture();
      }
    };
  }

  /**
   * Handles resize event
   */
  protected resizeHandler(e: MouseEvent) {
    const panel = this.$refs.basePanel as HTMLElement;
    const parentElement = this.findRelativeParentElement(panel);
    const elOffsetWidth = panel.offsetWidth;
    const elOffsetHeight = panel.offsetHeight;
    const distX = e.clientX - (panel.offsetLeft + elOffsetWidth);
    const distY = e.clientY - (panel.offsetTop + elOffsetHeight);
    if ((panel as any).setCapture) {
      (panel as any).setCapture();
    }

    document.onmousemove = (e) => {
      e.preventDefault();
      let w = e.clientX - distX - panel.offsetLeft; // width
      let h = e.clientY - distY - panel.offsetTop; // height

      const pOffsetWidth = parentElement.offsetWidth;
      const pOffsetHeight = parentElement.offsetHeight;
      w = Math.min(Math.max(w, this.minWidth), Math.min(pOffsetWidth - panel.offsetLeft, this.maxWidth));
      h = Math.min(Math.max(h, this.minHeight), Math.min(pOffsetHeight - panel.offsetTop, this.maxHeight));

      panel.style.width = w + "px";
      panel.style.height = h + "px";
      this.resize();
    };
    document.onmouseup = () => {
      document.onmousemove = document.onmousedown = null;
      if ((panel as any).releaseCapture) {
        (panel as any).releaseCapture();
      }
    };
  }

  // find the closest ancestor whoes width is non-zero
  private findRelativeParentElement(el: HTMLElement): any {
    const pElement = el.parentElement;
    if (!pElement || pElement.offsetWidth) {
      return pElement;
    } else {
      return this.findRelativeParentElement(pElement);
    }
  }

  protected beforeDestroy() {
  }

  protected render(): VNode {
    return (
      <div class={ styles.basePanel } ref="basePanel">
        <div class="base-panel__header" onMousedown={ this.dragHandler }>
          <span class="base-panel__header-title">
            { this.$scopedSlots.header && this.$scopedSlots.header({ text: "" }) }
            { !this.$scopedSlots.header && "Title" }
          </span>
          <el-button type="text" icon="el-icon-close" class="base-panel__header-close" onClick={ this.close }></el-button>
        </div>
        <div class="base-panel__body">
          { this.$scopedSlots.content && this.$scopedSlots.content({ text: "" }) }
        </div>
        <div class="base-panel__footer">
          <div class="base-panel__footer-resize" onMousedown={ this.resizeHandler }>
          </div>
        </div>
      </div>
    );
  }
}
