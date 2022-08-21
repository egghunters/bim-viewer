import { Component, Vue, Prop, Watch } from "vue-property-decorator";
import { VNode } from "vue/types/umd";
import styles from "./ProgressBar.module.scss";

const Progressbar = require("progressbar.js");
const options = {
  duration: 100,
  from: { color: "#409EFF" },
  to: { color: "#67C23A" },
  strokeWidth: 1,
  trailWidth: 0.4,
  step: function(state: any, line: any) {
    line.path.setAttribute("stroke", state.color);
  },
  text: {
    style: {
      color: "#888888"
    },
    autoStyleContainer: true
  },
  easing: "easeInOut"
};

export interface ProgressBarProps {
  progressValue: number,
  text: string
}

@Component
export default class ProgressBar extends Vue {
  @Prop({ default: 0 }) progressValue!: ProgressBarProps["progressValue"];
  @Prop({ default: "Loading..." }) text?: ProgressBarProps["text"];

  progressBar?: any; // Progressbar

  mounted() {
    this.initProgressbar();
  }

  beforeDestroy() {
    this.progressBar.destroy();
  }

  @Watch("progressValue")
  updateProgressBar(v: number) {
    if (v < 100) {
      this.progressBar.setText(`${this.text}: ${v}%`);
    } else {
      this.progressBar.setText("Loaded, a moment please...");
    }
    this.progressBar.animate(v / 100);
  }

  initProgressbar() {
    this.progressBar = new Progressbar.Line(this.$refs.progressBar as HTMLElement, options);
  }

  protected render(): VNode {
    return (
      <div class={styles.progressBarWrapper}>
        <div ref="progressBar" class={styles.progressBar}></div>
      </div>
    );
  }
}
