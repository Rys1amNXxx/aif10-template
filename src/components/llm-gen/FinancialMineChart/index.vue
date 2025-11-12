<template>

  <div
    class="relative border border-border-08 black:border-border-08-dark rounded-md shadow-[inset_0_4px_30px_rgba(88,108,158,0.12)]">
    <!-- 左上角控制按钮 -->
    <div class="absolute top-4 left-4 flex gap-2.5 z-10">
      <button type="button" class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#5261a7] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow"
        @click="handleRefresh" aria-label="刷新图谱">
        ↻
      </button>
      <button type="button" class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#5261a7] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow"
        @click="() => handleZoom(1.15)" aria-label="放大图谱">
        +
      </button>
      <button type="button" class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#5261a7] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow"
        @click="() => handleZoom(0.85)" aria-label="缩小图谱">
        -
      </button>
    </div>

    <!-- 左下角水印 -->
    <div class="absolute left-[14px] bottom-[14px] text-[11px] text-[#9FA9B5] black:text-[#768496] 
      pointer-events-none leading-[1.4] max-w-[260px] z-10">
      <p>· 数据取自董事会经营综述、研报和互动易</p>
      <p>· 内容由 AI 生成</p>
    </div>

    <div id="container"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useDark } from '@vueuse/core';
import { Rect as GRect, Text as GText } from '@antv/g';
import {
  Badge,
  CommonEvent,
  ExtensionCategory,
  Graph,
  GraphEvent,
  iconfont,
  Label,
  Polyline,
  Rect,
  register,
  subStyleProps,
  treeToGraphData,
} from '@antv/g6';

import data from './config.json';

// 主题监听
const isDark = useDark();

// 主题配色方案
const themeColors = computed(() => {
  if (isDark.value) {
    return {
      // 节点
      nodeFill: '#1D273F',           // background-16-dark
      nodeBorder: '#374152',         // border-01-dark
      nodeText: '#F9FBFC',           // text-01-dark
      nodeSecondaryText: '#BCC3CE',  // text-04-dark
      // 边
      edgeStroke: '#828FA1',         // border-01-dark
      edgeLabelFill: '#F0F4F9',      // text-03-dark
      // 标签
      tagNormalBg: '#F0F4F91F',
      tagNormalBorder: 'rgba(130, 143, 161, 0.2)',
      tagNormalText: '#F0F4F9',
      tagSpecialBg: '#FD20331F',
      tagSpecialBorder: '#FF2436',
      tagSpecialText: '#FD2033',
      // 折叠按钮
      collapseBg: '#1D273F',
      collapseBorder: '#374152',
      collapseFill: '#BCC3CE',
    };
  } else {
    return {
      // 节点
      nodeFill: '#FFFFFF',           // background-00
      nodeBorder: '#EBEDF0',         // border-01
      nodeText: '#131B2A',           // text-01
      nodeSecondaryText: '#768496',  // text-04
      // 边
      edgeStroke: '#828FA1',
      edgeLabelFill: '#2A354E',
      // 标签
      tagNormalBg: '#7684961F',
      tagNormalBorder: 'rgba(118, 132, 150, 0.12)',
      tagNormalText: '#768496',
      tagSpecialBg: '#FD20331F',
      tagSpecialBorder: '#FF4D4F',
      tagSpecialText: '#FD2033',
      // 折叠按钮
      collapseBg: '#FFFFFF',
      collapseBorder: '#EBEDF0',
      collapseFill: '#828FA1',
    };
  }
});

const style = document.createElement('style');
style.innerHTML = `@import url('${iconfont.css}');`;
document.head.appendChild(style);

const TITLE_TAG_GAP = 9;
const TAG_HORIZONTAL_PADDING = 12;
const TAG_VERTICAL_PADDING = 9;
const TAG_MIN_WIDTH = 36;

const COLLAPSED_SIZE: [number, number] = [288, 72];
const EXPANDED_SIZE: [number, number] = [288, 180];
const BASE_HORIZONTAL_GAP = 35;
const COLLAPSE_TARGET_NAME = 'collapse-button';
const HOVER_TOOLTIP_KEY = 'node-hover-tooltip';
const CLICK_TOOLTIP_KEY = 'node-click-tooltip';

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDetailToHtml = (detail: string) =>
  detail
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

const getItemData = (item: any) => {
  if (!item) return undefined;
  return item.data ?? item.model?.data ?? item.model;
};

const isCollapseTarget = (event: any) => {
  const checkShape = (shape: any): boolean => {
    if (!shape) return false;
    const namesToCheck = [
      shape?.name,
      shape?.cfg?.name,
      shape?.attributes?.name,
      typeof shape.get === 'function' ? shape.get('name') : undefined,
      typeof shape.getAttribute === 'function' ? shape.getAttribute('name') : undefined,
    ];
    if (namesToCheck.some((name) => name === COLLAPSE_TARGET_NAME || name === 'collapse')) return true;
    return checkShape(shape.parent);
  };

  const target = event?.target ?? event?.shape ?? event?.detail?.shape;
  if (checkShape(target)) return true;

  const originalTarget = event?.originalEvent?.target;
  if (checkShape(originalTarget)) return true;

  const domEventTarget = event?.originalEvent?.originalEvent?.target;
  if (checkShape(domEventTarget)) return true;

  const key = event?.key ?? event?.name;
  if (key === COLLAPSE_TARGET_NAME || key === 'collapse') return true;

  return false;
};

const getDetailFromItems = (items: any[] | undefined, graph?: Graph) => {
  if (!items || items.length === 0) return undefined;
  const item = items[0];
  const data = getItemData(item);
  if (data?.detail) return data.detail;
  const id = item?.id ?? item?.data?.id ?? item?.model?.id;
  if (graph && id) {
    try {
      const nodeData = graph.getNodeData(id);
      return nodeData?.detail;
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
};

const getEventDetail = (event: any, graph?: Graph) => {
  if (isCollapseTarget(event)) return undefined;
  const item = event?.item ?? event?.target ?? event?.items?.[0];
  const data = getItemData(item);
  if (data?.detail) return data.detail;

  const id =
    item?.id ??
    item?.data?.id ??
    item?.model?.id ??
    event?.id ??
    event?.target?.id ??
    event?.currentTarget;

  if (graph && id) {
    try {
      const nodeData = graph.getNodeData(id);
      return nodeData?.detail;
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
};

function createHoverTooltipPlugin(this: Graph) {
  const dark = isDark.value;
  const graph = this;
  return {
    key: HOVER_TOOLTIP_KEY,
    type: 'tooltip' as const,
    trigger: 'hover' as const,
    itemTypes: ['node'],
    style: {
      '.tooltip': {
        background: dark ? '#4A5465' : '#FFFFFF',
        border: dark ? '1px solid #374152' : '#EBEDF0',
      },
    },
    enable(event: any) {
      if (isCollapseTarget(event)) return false;
      const detail = getEventDetail(event, graph);
      if (!detail) return false;
      const clickTooltip = graph.getPluginInstance(CLICK_TOOLTIP_KEY) as any;
      const currentTarget = event?.item?.id ?? event?.target?.id ?? event?.currentTarget;
      if (clickTooltip && clickTooltip.currentTarget === currentTarget) {
        return false;
      }
      return true;
    },
    getContent: (evt: any) => {
      if (isCollapseTarget(evt)) return '';
      const textColor = dark ? '#F0F4F9' : '#4A5465';
      return `<div style="font-size: 12px; font-weight: 400; color: ${textColor}; white-space: nowrap;">点击查看详细信息</div>`;
    },
  };
}

function createClickTooltipPlugin(this: Graph) {
  const dark = isDark.value;
  const graph = this;
  return {
    key: CLICK_TOOLTIP_KEY,
    type: 'tooltip' as const,
    trigger: 'click' as const,
    itemTypes: ['node'],
    style: {
      ".tooltip": {
        background: dark ? '#4A5465' : '#FFFFFF',
        border: dark ? '1px solid #374152' : '#EBEDF0',
      },
    },
    enable(event: any) {
      if (isCollapseTarget(event)) return false;
      return Boolean(getEventDetail(event, graph));
    },
    getContent: (evt: any, items: any[]) => {
      if (isCollapseTarget(evt)) return '';
      const detail = getDetailFromItems(items, graph);
      if (!detail) return '';

      // const dark = isDark.value;
      const textColor = dark ? '#F0F4F9' : '#4A5465';
      const titleColor = dark ? '#BCC3CE' : '#768496';

      return `
        <div style="max-width: 360px; background: transparent; border: transparent; border-radius: 12px; font-size: 12px; line-height: 1.6; color: ${textColor}">
          <div style="font-size: 12px; font-weight: 600; color: ${titleColor}; margin-bottom: 8px;">节点描述</div>
          <div>${formatDetailToHtml(detail)}</div>
        </div>
      `;
    },
    onOpenChange(open: boolean) {
      if (open) {
        const hoverTooltip = graph.getPluginInstance(HOVER_TOOLTIP_KEY) as any;
        hoverTooltip?.hide?.();
      }
    },
  };
}

class TreeNode extends Rect {
  get data() {
    return this.context.model.getNodeLikeDatum(this.id);
  }

  get childrenData() {
    return this.context.model.getChildrenData(this.id);
  }

  getSize(attributes) {
    const expanded = attributes.expanded ?? false;
    return expanded ? EXPANDED_SIZE : COLLAPSED_SIZE;
  }

  getLabelStyle(attributes) {
    const [width, height] = this.getSize(attributes);
    return {
      x: -width / 2 + 10,
      y: -height / 2 + 23,
      text: this.data.name,
      fontSize: 14,
      opacity: 0.85,
      fill: themeColors.value.nodeText,
      // cursor: 'pointer',
      fontWeight: 600,
      wordWrap: false,
      wordWrapWidth: width - 20,
      maxLines: 1,
      textOverflow: 'clip',
    };
  }

  getPriceStyle(attributes) {
    const [width, height] = this.getSize(attributes);

    // 展开状态：把营收&占比挪到灰色容器上方
    // if (attributes.expanded) {
    //   const rectStyle: any = this.getDetailContainerRectStyle(attributes);
    //   // rectStyle.y 是灰容器的 top，我们往上挪一点
    //   const y = rectStyle ? rectStyle.y : -height / 2 + 36;

    //   return {
    //     x: -width / 2 + 8,
    //     y,
    //     text: this.data.label,
    //     fontSize: 14,
    //     fill: 'gray',
    //     opacity: 0.85,
    //   };
    // }

    // 未展开：保持原来的位置在卡片底部
    return {
      x: -width / 2 + 8,
      y: height / 2 - 12,
      text: this.data.label,
      fontSize: 14,
      fill: themeColors.value.nodeSecondaryText,
      opacity: 0.85,
    };
  }

  drawPriceShape(attributes, container) {
    const priceStyle = this.getPriceStyle(attributes);
    this.upsert('price', GText, priceStyle, container);
  }

  getCollapseStyle(attributes) {
    if (this.childrenData.length === 0) return false;
    const { collapsed } = attributes;
    const [width, height] = this.getSize(attributes);
    return {
      backgroundFill: themeColors.value.collapseBg,
      backgroundHeight: 16,
      backgroundLineWidth: 1,
      backgroundRadius: 0,
      backgroundStroke: themeColors.value.collapseBorder,
      backgroundWidth: 16,
      cursor: 'pointer',
      fill: themeColors.value.collapseFill,
      fontSize: 16,
      text: collapsed ? '+' : '-',
      textAlign: 'center',
      textBaseline: 'middle',
      x: width / 2 + 10,
      y: 0,
      name: COLLAPSE_TARGET_NAME,
      tooltip: false,
    };
  }

  drawCollapseShape(attributes, container) {
    const collapseStyle = this.getCollapseStyle(attributes);
    const btn = this.upsert('collapse', Badge, collapseStyle, container);

    if (btn && !Reflect.has(btn, '__bind__')) {
      Reflect.set(btn, '__bind__', true);
      const stopPointerPropagation = (e: any) => {
        e?.stopPropagation?.();
        e?.stopImmediatePropagation?.();
      };

      btn.addEventListener(CommonEvent.POINTER_ENTER, stopPointerPropagation);
      btn.addEventListener(CommonEvent.POINTER_MOVE, stopPointerPropagation);
      btn.addEventListener(CommonEvent.POINTER_LEAVE, stopPointerPropagation);
      btn.addEventListener(CommonEvent.POINTER_OVER, stopPointerPropagation);
      btn.addEventListener(CommonEvent.POINTER_OUT, stopPointerPropagation);
      btn.addEventListener(CommonEvent.CLICK, (event: any) => {
        stopPointerPropagation(event);
        const { collapsed } = this.attributes;
        const graph = this.context.graph;
        if (collapsed) {
          graph.expandElement(this.id);
        } else {
          graph.collapseElement(this.id);
        }
      });
    }
  }

  getKeyStyle(attributes) {
    const keyStyle = super.getKeyStyle(attributes);
    return {
      ...keyStyle,
      fill: themeColors.value.nodeFill,
      lineWidth: 1,
      stroke: themeColors.value.nodeBorder,
    };
  }

  getLabelTextShape() {
    if (!this.shapeMap) return undefined;
    const shapes = Object.values(this.shapeMap) as any[];
    return shapes.find(
      (shape) => shape instanceof GText && shape?.attributes?.text === this.data.name,
    );
  }

  getLabelBounds() {
    const labelShape: any = this.getLabelTextShape();
    if (labelShape?.getLocalBounds) {
      return labelShape.getLocalBounds();
    }
    return undefined;
  }

  estimateTextWidth(text: string | number | undefined, fontSize: number) {
    if (!text) return 0;
    const str = String(text);
    return Array.from(str).reduce((sum, char) => {
      const isFullWidth = char.charCodeAt(0) > 255;
      const ratio = isFullWidth ? 1 : 0.6;
      return sum + fontSize * ratio;
    }, 0);
  }

  getTagStyle(attributes) {
    // 没有 tag 就不画
    if (!this.data.tag) return false;

    const labelStyle: any = this.getLabelStyle(attributes);
    const labelBounds = this.getLabelBounds();
    const labelRight = labelBounds ? labelBounds.max[0] : labelStyle.x + this.estimateTextWidth(labelStyle.text, labelStyle.fontSize ?? 12);
    const x = labelRight + TITLE_TAG_GAP;
    const y = labelStyle.y;          // 与标题同一行
    const tagFontSize = 12;
    const tagTextWidth = this.estimateTextWidth(this.data.tag, tagFontSize);
    const backgroundWidth = Math.max(TAG_MIN_WIDTH, tagTextWidth + TAG_HORIZONTAL_PADDING);
    const backgroundHeight = tagFontSize + TAG_VERTICAL_PADDING;

    const tagText = this.data.tag as string;
    const isCoreCashCow = tagText === '核心现金牛';

    return {
      backgroundFill: isCoreCashCow ? themeColors.value.tagSpecialBg : themeColors.value.tagNormalBg,
      backgroundStroke: isCoreCashCow ? themeColors.value.tagSpecialBorder : themeColors.value.tagNormalBorder,
      backgroundRadius: 2.8,
      backgroundWidth,
      backgroundHeight,
      x,
      y,
      text: tagText,
      fontSize: tagFontSize,
      fill: isCoreCashCow ? themeColors.value.tagSpecialText : themeColors.value.tagNormalText,
    };
  }

  // 画 tag
  drawTagShape(attributes, container) {
    const tagStyle = this.getTagStyle(attributes);
    if (!tagStyle) return;

    this.upsert('tag', Badge, tagStyle, container);
  }

  render(attributes = this.parsedAttributes, container) {
    super.render(attributes, container);
    this.drawTagShape(attributes, container);
    this.drawPriceShape(attributes, container);
    this.drawCollapseShape(attributes, container);
  }
}

register(ExtensionCategory.NODE, 'tree-node', TreeNode);

// 现在使用 G6 内置的 Polyline 和 labelText，不需要自定义边类

const graphRef = ref<Graph | null>(null);

const initGraph = async () => {
  // const response = await fetch('https://assets.antv.antgroup.com/g6/decision-tree.json');
  // const data = await response.json();

  // 创建一个变量来存储 graph 引用，用于布局函数中访问
  let graphInstance: Graph | null = null;

  const nodeHasChildrenMap = new Map<string, boolean>();

  const buildNodeMaps = (node: any) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    nodeHasChildrenMap.set(node.id, hasChildren);
    if (hasChildren) {
      node.children.forEach((child: any) => buildNodeMaps(child));
    }
  };
  buildNodeMaps(data);

  const graph = new Graph({
    container: 'container',
    data: treeToGraphData(data, {
      getNodeData: (datum, depth) => {
        if (!datum.style) datum.style = {};
        datum.style.size = [...COLLAPSED_SIZE];
        // 只在第4层及以后才默认折叠，让前三层都能正常显示
        datum.style.collapsed = depth >= 5;
        if (typeof datum.style.expanded === 'undefined') {
          datum.style.expanded = false;
        }
        // datum.style.size = COLLAPSED_SIZE;
        if (!datum.children) return datum;
        const { children, ...restDatum } = datum;
        return { ...restDatum, children: children.map((child) => child.id) };
      },
      getEdgeData: (source, target) => {
        // 如果目标节点有 rate 数据，则在边线终点显示百分比
        const rate = target?.rate;
        if (rate !== undefined && rate !== null) {
          const percentage = (rate * 100).toFixed(1) + '%';
          return {
            source: source.id,
            target: target.id,
            style: {
              labelText: percentage,
            }
          };
        }
        return {
          source: source.id,
          target: target.id,
        };
      },
    }),
    node: {
      type: 'tree-node',
      style: {
        size: [...COLLAPSED_SIZE],
        ports: [{ placement: 'left' }, { placement: 'right' }],
        radius: 4,
      },
    },
    edge: {
      type: 'polyline',
      style: {
        stroke: themeColors.value.edgeStroke,
        lineWidth: 1,
        router: {
          type: 'orth',
        },
        endArrow: true,
        endArrowType: 'circle',
        radius: 8,
        // 标签样式配置
        // labelText: '',
        labelFontSize: 12,
        labelFill: themeColors.value.edgeLabelFill,
        labelBackground: false,
        labelPadding: 0,
        labelOffsetX: -15,  // 向左偏移
        labelOffsetY: -10,   // 向上偏移
        labelPlacement: 'end', // 标签位置在终点
        labelAutoRotate: false, // 不自动旋转
      },
    },
    layout: {
      type: 'mindmap',
      direction: 'LR',
      getHeight: (node?: any) => {
        if (!node || !graphInstance) return COLLAPSED_SIZE[1];
        const nodeId = typeof node === 'string' ? node : node.id ?? node.data?.id;
        if (!nodeId) return COLLAPSED_SIZE[1];
        try {
          const nodeData = graphInstance.getNodeData(nodeId);
          const expanded = nodeData?.style?.expanded ?? false;
          return (expanded ? EXPANDED_SIZE : COLLAPSED_SIZE)[1];
        } catch (e) {
          return COLLAPSED_SIZE[1];
        }
      },
      getWidth: (node?: any) => {
        if (!node || !graphInstance) return COLLAPSED_SIZE[0];
        const nodeId = typeof node === 'string' ? node : node.id ?? node.data?.id;
        if (!nodeId) return COLLAPSED_SIZE[0];
        try {
          const nodeData = graphInstance.getNodeData(nodeId);
          const expanded = nodeData?.style?.expanded ?? false;
          return (expanded ? EXPANDED_SIZE : COLLAPSED_SIZE)[0];
        } catch (e) {
          return COLLAPSED_SIZE[0];
        }
      },
      getVGap: () => {
        // 使用固定的垂直间距
        return 4;
      },
      getHGap: () => BASE_HORIZONTAL_GAP,
    },
    plugins: [
      function () {
        return createClickTooltipPlugin.call(this);
      },
      function () {
        return createHoverTooltipPlugin.call(this);
      },
    ],
    behaviors: ['zoom-canvas', 'drag-canvas'],
  });

  // 保存 graph 实例引用
  graphInstance = graph;

  const hideClickTooltip = () => {
    const clickTooltip = graph.getPluginInstance(CLICK_TOOLTIP_KEY) as any;
    clickTooltip?.hide?.();
  };

  const hideHoverTooltip = () => {
    const hoverTooltip = graph.getPluginInstance(HOVER_TOOLTIP_KEY) as any;
    hoverTooltip?.hide?.();
  };

  graph.once(GraphEvent.AFTER_RENDER, () => {
    graph.fitView();
  });

  graph.on('tooltip:show', (evt: any) => {
    if (!evt) return;
    const sourceEvent = evt?.originalEvent ?? evt?.event ?? evt;
    if (isCollapseTarget(sourceEvent)) {
      evt?.preventDefault?.();
      hideClickTooltip();
      hideHoverTooltip();
    }
  });

  graph.on('canvas:click', () => {
    hideClickTooltip();
    hideHoverTooltip();
  });

  graph.render();
  graphRef.value = graph;
};

const handleRefresh = () => {
  if (graphRef.value) {
    graphRef.value.destroy();
    graphRef.value = null;
  }
  void initGraph();
};

const handleZoom = (ratio: number) => {
  const graph = graphRef.value;
  if (!graph) return;
  void graph.zoomBy(ratio, undefined, graph.getViewportCenter());
};

onMounted(() => {
  void initGraph();
});

onBeforeUnmount(() => {
  graphRef.value?.destroy();
  graphRef.value = null;
});

// 监听主题切换，重新初始化图谱
watch(isDark, () => {
  handleRefresh();
});

</script>

<style scoped>
#container {
  width: 100%;
  height: 520px;
  border-radius: 16px;
  background: #F2F5FA;
  background-image: radial-gradient(#dbe1f5 1.5px, transparent 1px);
  background-size: 26px 26px;
}

.dark #container {
  background: #09101F;
  background-image: radial-gradient(#3d4a64 1.5px, transparent 1px);
  background-size: 26px 26px;
  border-radius: 16px;
}

.insight-shell {
  padding: 32px;
  background: linear-gradient(180deg, #edf2ff 0%, #dae4ff 100%);
  border-radius: 32px;
  border: 1px solid #b6c8ff;
  min-height: 100vh;
  box-sizing: border-box;
}

.insight-panel {
  background: #ffffff;
  border-radius: 28px;
  padding: 24px 28px 18px;
  box-shadow: 0 20px 45px rgba(80, 107, 166, 0.18);
  border: 1px solid #d6e0ff;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.insight-label {
  margin: 0;
  font-size: 14px;
  color: #6d7c9c;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.insight-title {
  margin: 4px 0 0;
  font-size: 24px;
  color: #1c2353;
  font-weight: 600;
}

.insight-toolbar {
  display: inline-flex;
  gap: 10px;
}

.insight-toolbar button {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #d4dcfb;
  background: #f6f8ff;
  color: #5261a7;
  font-size: 18px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: all 0.2s ease;
}

.insight-toolbar button:hover {
  background: #e6edff;
  color: #2e48c7;
}

.insight-toolbar span {
  display: inline-block;
  transform: translateY(-1px);
}


.insight-footer {
  font-size: 12px;
  color: #8a90ad;
  text-align: right;
}
</style>
