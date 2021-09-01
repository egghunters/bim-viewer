<template>
  <div
    class="el-tree-node"
    @click.stop="handleClick"
    @contextmenu="($event) => this.handleContextMenu($event)"
    v-show="source.visible"
    :class="{
      'is-expanded': expanded,
      'is-current': source.isCurrent,
      'is-hidden': !source.visible,
      'is-focusable': !source.disabled,
      'is-checked': !source.disabled && source.checked
    }"
    role="treeitem"
    tabindex="-1"
    :aria-expanded="expanded"
    :aria-disabled="source.disabled"
    :aria-checked="source.checked"
    ref="node"
  >
    <div class="el-tree-node__content"
      :style="{ 'padding-left': (source.level - 1) * tree.indent + 'px' }">
      <!-- <span aria-hidden="true" :style="{ 'width': (source.level - 1) * tree.indent + 'px' }"></span> -->
      <span
        @click.stop="handleExpandIconClick"
        :class="[
          { 'is-leaf': source.isLeaf, expanded: !source.isLeaf && expanded },
          'el-tree-node__expand-icon',
          tree.iconClass ? tree.iconClass : 'el-icon-caret-right'
        ]"
      >
      </span>
      <el-checkbox
        v-if="showCheckbox"
        v-model="source.checked"
        :indeterminate="source.indeterminate"
        :disabled="!!source.disabled"
        @click.native.stop
        @change="handleCheckChange"
      >
      </el-checkbox>
      <span
        v-if="source.loading"
        class="el-tree-node__loading-icon el-icon-loading">
      </span>
      <node-content :node="source"></node-content>
    </div>
  </div>
</template>

<script type="text/jsx">
import ElCheckbox from 'element-ui/packages/checkbox';
import emitter from 'element-ui/src/mixins/emitter';
import mixinNode from './mixin/node';
import { getNodeKey } from './model/util';

export default {
  name: 'ElTreeVirtualNode',
  componentName: 'ElTreeVirtualNode',

  mixins: [emitter, mixinNode],

  props: {
    source: {
      default() {
        return {};
      }
    },
    renderContent: Function,
    showCheckbox: {
      type: Boolean,
      default: false
    }
  },

  components: {
    ElCheckbox,
    NodeContent: {
      props: {
        node: {
          required: true
        }
      },
      render(h) {
        const parent = this.$parent;
        const tree = parent.tree;
        const node = this.node;
        const { data, store } = node;
        return (
          parent.renderContent
            ? parent.renderContent.call(parent._renderProxy, h, { _self: tree.$vnode.context, node, data, store })
            : tree.$scopedSlots.default
              ? tree.$scopedSlots.default({ node, data })
              : <span class="el-tree-node__label">{ node.label }</span>
        );
      }
    }
  },

  data() {
    return {
      tree: null,
      expanded: false,
      childNodeRendered: false,
      oldChecked: null,
      oldIndeterminate: null
    };
  },

  watch: {
    'source.indeterminate'(val) {
      this.handleSelectChange(this.source.checked, val);
    },

    'source.checked'(val) {
      this.handleSelectChange(val, this.source.indeterminate);
    },

    'source.expanded'(val) {
      this.$nextTick(() => this.expanded = val);
      if (val) {
        this.childNodeRendered = true;
      }
    }
  },

  created() {
    const parent = this.$parent.$parent.$parent;
    this.creator(parent, 'source');
  }
};
</script>
