<template>

  <div
    class="relative border border-border-08 black:border-border-08-dark rounded-2xl shadow-[inset_0_4px_30px_rgba(88,108,158,0.12)]">
    <!-- 左上角控制按钮 -->
    <div class="absolute top-3 left-3 flex gap-2 z-10">
      <button type="button"
        class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#768496] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow flex items-center justify-center"
        @click="handleRefresh" aria-label="刷新图谱">
        <ResetIcon />
      </button>
      <button type="button"
        class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#768496] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow flex items-center justify-center"
        @click="() => handleZoom(1.15)" aria-label="放大图谱">
        <ZoomInIcon />
      </button>
      <button type="button"
        class="w-7 h-7 rounded border border-border-08 black:border-border-03-dark 
        bg-white black:bg-[#111A31] text-[#768496] black:text-text-02-01-dark text-base 
        cursor-pointer transition-all hover:bg-[#e6edff] black:hover:bg-background-03-dark shadow flex items-center justify-center"
        @click="() => handleZoom(0.85)" aria-label="缩小图谱">
        <ZoomOutIcon />
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
import { Circle as GCircle, HTML as GHTML, Line as GLine, Rect as GRect, Text as GText } from '@antv/g';
import ResetIcon from '@/components/icons/Reset.vue';
import ZoomInIcon from '@/components/icons/zoomIn.vue';
import ZoomOutIcon from '@/components/icons/zoomOut.vue';
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
      nodeFill: '#1D273F',
      nodeBorder: '#374152',
      nodeText: '#F9FBFC',
      nodeSecondaryText: '#BCC3CE',
      // 边
      edgeStroke: '#828FA1',
      edgeLabelFill: '#F0F4F9',
      // 标签
      tagNormalBg: '#F0F4F91F',
      tagNormalBorder: 'rgba(130, 143, 161, 0.2)',
      tagNormalText: '#F0F4F9A0',
      tagSpecialBg: '#FD20331F',
      tagSpecialBorder: '#FF2436',
      tagSpecialText: '#FD2033',
      // 折叠按钮
      collapseBg: '#1D273F',
      collapseBorder: '#374152',
      collapseFill: '#BCC3CE',
      // 详情图标
      detailIconStroke: '#5261A7',
      detailIconFill: '#5261A7',
    };
  } else {
    return {
      // 节点
      nodeFill: '#FFFFFF',
      nodeBorder: '#EBEDF0',
      nodeText: '#131B2A',
      nodeSecondaryText: '#768496',
      // 边
      edgeStroke: '#828FA1AA',
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
      // 详情图标
      detailIconStroke: '#5261A7',
      detailIconFill: '#5261A7',
    };
  }
});

const COLLAPSE_EXPAND_ANIMATION = {
  duration: 400,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

const style = document.createElement('style');
style.innerHTML = `@import url('${iconfont.css}');`;
document.head.appendChild(style);

const TITLE_TAG_GAP = 6;
const TAG_HORIZONTAL_PADDING = 12;
const TAG_VERTICAL_PADDING = 9;
const DETAIL_ICON_SIZE = 14;
const DETAIL_ICON_GAP = 4;
const DETAIL_TRIGGER_NAME = 'detail-trigger';

const NODE_WIDTH = 290;
const NODE_MIN_HEIGHT = 72;
const LABEL_FONT_SIZE = 14;
const LABEL_LINE_HEIGHT = 20;
const LABEL_BOTTOM_MARGIN = 10;
const TITLE_LABEL_GAP = 8;
const LABEL_LEFT_PADDING = 26;
const LABEL_RIGHT_PADDING = 10;
const TITLE_AREA_HEIGHT = 32;

// 计算文本换行后的行数
const calculateTextLines = (text: string, maxWidth: number, fontSize: number): number => {
  if (!text) return 1;
  const availableWidth = maxWidth - LABEL_LEFT_PADDING - LABEL_RIGHT_PADDING;
  let lines = 1;
  let currentWidth = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    const charWidth = (code > 255) ? fontSize : fontSize * 0.6; // 中文字符按字体大小，英文字符按0.6倍

    if (currentWidth + charWidth > availableWidth && currentWidth > 0) {
      lines++;
      currentWidth = charWidth;
    } else {
      currentWidth += charWidth;
    }
  }

  return lines;
};

// 计算节点高度（基于 label 内容）
const calculateNodeHeight = (label: string | undefined): number => {
  if (!label) return NODE_MIN_HEIGHT;

  const labelWidth = NODE_WIDTH;
  const labelLines = calculateTextLines(String(label), labelWidth, LABEL_FONT_SIZE);

  // 基础高度 = 标题区域 + label区域(行数 * 行高) + 底部间距
  const labelAreaHeight = labelLines * LABEL_LINE_HEIGHT;
  const calculatedHeight = TITLE_AREA_HEIGHT + TITLE_LABEL_GAP + labelAreaHeight + LABEL_BOTTOM_MARGIN;
  return Math.max(calculatedHeight, NODE_MIN_HEIGHT);
};

const COLLAPSE_TARGET_NAME = 'collapse-button';
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

const isDetailTrigger = (event: any) => {
  const checkShape = (shape: any): boolean => {
    if (!shape) return false;
    const namesToCheck = [
      shape?.name,
      shape?.cfg?.name,
      shape?.attributes?.name,
      typeof shape.get === 'function' ? shape.get('name') : undefined,
      typeof shape.getAttribute === 'function' ? shape.getAttribute('name') : undefined,
    ];
    if (namesToCheck.some((name) => name === DETAIL_TRIGGER_NAME)) return true;
    return checkShape(shape.parent);
  };

  const target = event?.target ?? event?.shape ?? event?.detail?.shape;
  if (checkShape(target)) return true;

  const originalTarget = event?.originalEvent?.target;
  if (checkShape(originalTarget)) return true;

  const domEventTarget = event?.originalEvent?.originalEvent?.target;
  if (checkShape(domEventTarget)) return true;

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
  if (isCollapseTarget(event) || !isDetailTrigger(event)) return undefined;
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
        background: '#000000D9',
        border: 'none',
      },
    },
    enable(event: any) {
      if (isCollapseTarget(event)) return false;
      if (event?.detailTrigger) return true;
      return isDetailTrigger(event) && Boolean(getEventDetail(event, graph));
    },
    getContent: (evt: any, items: any[]) => {
      const nodeId =
        evt?.data?.id ??
        evt?.target?.id ??
        items?.[0]?.id ??
        items?.[0]?.model?.id ??
        evt?.item?.id ??
        evt?.item?.model?.id;

      if (!nodeId) return '';

      let detail = null;
      try {
        const nodeData = graph.getNodeData(nodeId);
        detail = nodeData?.detail;
      } catch (e) {
        return '';
      }

      if (!detail) return '';

      const textColor = '#FFFFFF';
      const titleColor = '#FFFFFF';

      return `
        <div style="max-width: 360px; background: transparent; border: transparent; border-radius: 12px; font-size: 14px; line-height: 1.6; color: ${textColor}">
          <div style="font-size: 14px; font-weight: 600; color: ${titleColor}; margin-bottom: 8px;">节点描述</div>
          <div>${formatDetailToHtml(detail)}</div>
        </div>
      `;
    },
    onOpenChange() { },
  };
}


// 全局变量存储 graph 实例引用（用于事件处理函数）
let globalGraphInstance: Graph | null = null;

// 生成节点 HTML 内容的函数
const generateNodeHTML = (nodeData: any, isExpanded: boolean, hasChildren: boolean) => {

  // 根据 label 内容动态计算节点高度
  const width = NODE_WIDTH;
  const height = calculateNodeHeight(nodeData.label);
  const colors = themeColors.value;
  const basePadding = 10;
  const iconOffset = DETAIL_ICON_SIZE + DETAIL_ICON_GAP;
  const availableWidth = width - (basePadding + iconOffset) - 20;

  // 获取节点层级（depth），从 nodeData.style.depth 或 nodeData.depth 获取
  const depth = nodeData?.style?.depth ?? nodeData?.depth ?? 0;
  // 第三级节点（depth >= 2，因为从0开始计数）开始不加粗
  const fontWeight = depth >= 2 ? 400 : 600;

  // 标题文本
  const titleText = escapeHtml(String(nodeData.name || ''));
  const titleLeft = basePadding + iconOffset;
  const titleTop = 12;
  const titleStyle = `
    position: absolute;
    left: ${titleLeft}px;
    top: ${titleTop}px;
    font-size: 14px;
    font-weight: ${fontWeight};
    color: ${colors.nodeText};
    opacity: 0.85;
    cursor: pointer;
    max-width: ${availableWidth}px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 20px;
  `;

  // 详情图标 SVG
  const detailIconSVG = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; cursor: pointer;">
      <path
        d="M12.6667 1.33337H3.33341C2.96522 1.33337 2.66675 1.63185 2.66675 2.00004V14C2.66675 14.3682 2.96522 14.6667 3.33341 14.6667H12.6667C13.0349 14.6667 13.3334 14.3682 13.3334 14V2.00004C13.3334 1.63185 13.0349 1.33337 12.6667 1.33337Z"
        stroke="${colors.detailIconStroke}" stroke-width="1.33333" stroke-linejoin="round" />
      <path d="M7 4.66663H11" stroke="${colors.detailIconStroke}" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M7 8H11" stroke="${colors.detailIconStroke}" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M7 11.3334H11" stroke="${colors.detailIconStroke}" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
      <path fill-rule="evenodd" clip-rule="evenodd"
        d="M4.99992 5.33333C5.36812 5.33333 5.66659 5.03487 5.66659 4.66667C5.66659 4.29847 5.36812 4 4.99992 4C4.63172 4 4.33325 4.29847 4.33325 4.66667C4.33325 5.03487 4.63172 5.33333 4.99992 5.33333Z"
        fill="${colors.detailIconStroke}" />
      <path fill-rule="evenodd" clip-rule="evenodd"
        d="M4.99992 8.66671C5.36812 8.66671 5.66659 8.36824 5.66659 8.00004C5.66659 7.63184 5.36812 7.33337 4.99992 7.33337C4.63172 7.33337 4.33325 7.63184 4.33325 8.00004C4.33325 8.36824 4.63172 8.66671 4.99992 8.66671Z"
        fill="${colors.detailIconStroke}" />
      <path fill-rule="evenodd" clip-rule="evenodd"
        d="M4.99992 12C5.36812 12 5.66659 11.7015 5.66659 11.3333C5.66659 10.9651 5.36812 10.6666 4.99992 10.6666C4.63172 10.6666 4.33325 10.9651 4.33325 11.3333C4.33325 11.7015 4.63172 12 4.99992 12Z"
        fill="${colors.detailIconStroke}" />
    </svg>
  `;

  // 详情图标（和标题垂直居中对齐）
  const detailIconStyle = `
    position: absolute;
    left: ${basePadding}px;
    top: ${titleTop + 2}px;
    width: ${DETAIL_ICON_SIZE}px;
    height: ${DETAIL_ICON_SIZE}px;
    cursor: pointer;
  `;

  // 标签（如果有）
  let tagHTML = '';
  if (nodeData.tag) {
    const tagText = escapeHtml(String(nodeData.tag));
    const isCoreCashCow = tagText === '核心现金牛';
    const tagBg = isCoreCashCow ? colors.tagSpecialBg : colors.tagNormalBg;
    const tagBorder = isCoreCashCow ? colors.tagSpecialBorder : colors.tagNormalBorder;
    const tagTextColor = isCoreCashCow ? colors.tagSpecialText : colors.tagNormalText;

    // 估算标题文本宽度（中文字符按14px，英文字符按8.4px计算）
    const estimateTitleWidth = (text: string) => {
      let width = 0;
      for (const char of text) {
        const code = char.charCodeAt(0);
        width += (code > 255) ? 14 : 8.4;
      }
      return Math.min(width, availableWidth);
    };
    const titleWidth = estimateTitleWidth(nodeData.name || '');

    // tag紧贴标题右侧，和标题水平对齐
    const tagLeft = titleLeft + titleWidth + TITLE_TAG_GAP;
    const tagTop = titleTop;

    tagHTML = `
      <div style="
        position: absolute;
        left: ${tagLeft}px;
        top: ${tagTop}px;
        background: ${tagBg};
        border-radius: 4px;
        padding: ${TAG_VERTICAL_PADDING / 2}px ${TAG_HORIZONTAL_PADDING / 2}px;
        font-size: 12px;
        color: ${tagTextColor};
        white-space: nowrap;
        pointer-events: none;
        line-height: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
      ">${tagText}</div>
    `;
  }

  // 价格标签
  const priceText = escapeHtml(String(nodeData.label || ''));
  const labelWidth = width - LABEL_LEFT_PADDING - LABEL_RIGHT_PADDING;

  const priceStyle = `
    position: absolute;
    left: ${LABEL_LEFT_PADDING}px;
    bottom: ${LABEL_BOTTOM_MARGIN}px;
    width: ${labelWidth}px;
    font-size: ${LABEL_FONT_SIZE}px;
    line-height: ${LABEL_LINE_HEIGHT}px;
    color: ${colors.nodeSecondaryText};
    opacity: 0.85;
    word-wrap: break-word;
    word-break: break-all;
  `;

  // 折叠按钮（如果有子节点）
  let collapseButtonHTML = '';
  if (hasChildren) {
    // 按钮位置：在节点卡片右侧中间
    const collapseButtonStyle = `
      position: absolute;
      right: -20px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      background: ${colors.collapseBg};
      border: 1px solid ${colors.collapseBorder};
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const collapseIconColor = colors.collapseFill;
    // 修复icon：使用正确的viewBox和坐标
    const collapseIcon = isExpanded
      ? `<line x1="3" y1="9" x2="15" y2="9" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />`
      : `<line x1="3" y1="9" x2="15" y2="9" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />
         <line x1="9" y1="3" x2="9" y2="15" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />`;

    collapseButtonHTML = `
      <div class="collapse-button" style="${collapseButtonStyle}" onclick="handleCollapseClick('${nodeData.id}')">
        <svg width="18" height="18" viewBox="0 0 18 18" style="display: block;">
          ${collapseIcon}
        </svg>
      </div>
    `;
  }

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      position: relative;
      background: ${colors.nodeFill};
      border: 1px solid ${colors.nodeBorder};
      border-radius: 4px;
      box-sizing: border-box;
    ">
      <!-- 详情图标 -->
      <div class="detail-icon" style="${detailIconStyle}" onclick="handleDetailIconClick(event, '${nodeData.id}')">
        ${detailIconSVG}
      </div>
      
      <!-- 标题文本 -->
      <div class="detail-title" style="${titleStyle}" onclick="handleTitleClick(event, '${nodeData.id}')">
        ${titleText}
      </div>
      
      <!-- 标签 -->
      ${tagHTML}
      
      <!-- 价格标签 -->
      <div style="${priceStyle}">${priceText}</div>
      
      <!-- 折叠按钮 -->
      ${collapseButtonHTML}
    </div>
  `;
};

// 全局事件处理函数
(window as any).handleDetailIconClick = (event: MouseEvent, nodeId: string) => {
  event.stopPropagation();
  event.preventDefault();
  if (!globalGraphInstance) return;

  const nodeData = globalGraphInstance.getNodeData(nodeId);
  if (!nodeData?.detail) return;

  const clickTooltip = globalGraphInstance.getPluginInstance(CLICK_TOOLTIP_KEY) as any;
  if (clickTooltip && typeof clickTooltip.show === 'function') {
    clickTooltip.hide?.();
    clickTooltip.show({
      detailTrigger: true,
      target: { id: nodeId, type: 'node' },
      targetType: 'node',
      itemType: 'node',
      item: { id: nodeId },
      data: { id: nodeId },
      client: { x: event.clientX, y: event.clientY },
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }
};

(window as any).handleTitleClick = (event: MouseEvent, nodeId: string) => {
  event.stopPropagation();
  event.preventDefault();
  if (!globalGraphInstance) return;

  const nodeData = globalGraphInstance.getNodeData(nodeId);
  if (!nodeData?.detail) return;

  const clickTooltip = globalGraphInstance.getPluginInstance(CLICK_TOOLTIP_KEY) as any;
  if (clickTooltip && typeof clickTooltip.show === 'function') {
    clickTooltip.hide?.();
    clickTooltip.show({
      detailTrigger: true,
      target: { id: nodeId, type: 'node' },
      targetType: 'node',
      itemType: 'node',
      item: { id: nodeId },
      data: { id: nodeId },
      client: { x: event.clientX, y: event.clientY },
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }
};

(window as any).handleCollapseClick = async (nodeId: string) => {
  if (!globalGraphInstance) return;

  try {
    const nodeData = globalGraphInstance.getNodeData(nodeId);
    const collapsed = nodeData?.style?.collapsed ?? false;

    if (collapsed) {
      // expandElement 会自动处理布局和状态更新
      globalGraphInstance.expandElement(nodeId);
    } else {
      // collapseElement 会自动处理布局和状态更新
      globalGraphInstance.collapseElement(nodeId);
    }

    // 等待展开/收起操作完成，然后更新 HTML 并触发动画
    // 参考：https://g6.antv.antgroup.com/manual/animation/custom-animation
    setTimeout(async () => {
      const updatedNodeData = globalGraphInstance?.getNodeData(nodeId);
      if (updatedNodeData) {
        // 使用 updateNodeData 数组形式更新节点数据，参考文档示例
        globalGraphInstance?.updateNodeData([{
          ...updatedNodeData,
        }]);
        // 调用 draw() 触发更新动画
        await globalGraphInstance?.draw();
      }
    }, 50);
  } catch (e) {
    console.error('Error toggling collapse:', e);
  }
};

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
    animation: COLLAPSE_EXPAND_ANIMATION,
    data: treeToGraphData(data, {
      getNodeData: (datum, depth) => {
        if (!datum.style) datum.style = {};

        // 保存节点层级信息，用于生成 HTML 时判断标题粗细
        datum.style.depth = depth;

        // 根据 label 内容动态计算节点高度
        const nodeHeight = calculateNodeHeight(datum.label);
        datum.style.size = [NODE_WIDTH, nodeHeight];

        // 只在第4层及以后才默认折叠，让前三层都能正常显示
        datum.style.collapsed = depth >= 5;
        if (typeof datum.style.expanded === 'undefined') {
          datum.style.expanded = false;
        }
        if (!datum.children) return datum;
        const { children, ...restDatum } = datum;
        return { ...restDatum, children: children.map((child) => child.id) };
      },
      getEdgeData: (source, target) => {
        // 如果目标节点有 rate 数据，则在边线终点显示百分比
        // rate 只支持字符串类型（如 "33.0%"），如果为空值则不显示
        const rate = target?.rate;
        const edgeData: any = {
          source: source.id,
          target: target.id,
          // 指定使用右端和左端的端口
          sourcePort: 'right',
          targetPort: 'left',
        };
        // 只处理字符串类型且非空的 rate
        if (typeof rate === 'string' && rate.trim() !== '') {
          edgeData.style = {
            labelText: rate,
          };
        }
        return edgeData;
      },
    }),
    node: {
      type: 'html',
      style: {
        size: (d: any) => {
          const nodeId = d.id;
          const nodeData = graphInstance?.getNodeData(nodeId) || d.data || d;
          const nodeHeight = calculateNodeHeight(nodeData.label);
          return [NODE_WIDTH, nodeHeight];
        },
        innerHTML: (d: any) => {
          const nodeId = d.id;
          const nodeData = graphInstance?.getNodeData(nodeId) || d.data || d;
          const isExpanded = nodeData?.style?.expanded ?? false;
          const hasChildren = nodeHasChildrenMap.get(nodeId) ?? false;
          return generateNodeHTML(nodeData, isExpanded, hasChildren);
        },
        dx: () => {
          return -NODE_WIDTH / 2;
        },
        dy: (d: any) => {
          const nodeId = d.id;
          const nodeData = graphInstance?.getNodeData(nodeId) || d.data || d;
          const nodeHeight = calculateNodeHeight(nodeData.label);
          return -nodeHeight / 2;
        },
        // 配置连接点：从右端中间位置延出
        ports: [
          {
            placement: 'right', // 右端中间位置
          },
          {
            placement: 'left', // 左端中间位置（用于接收连接）
          }
        ],
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
        labelFontSize: 12,
        labelFill: themeColors.value.edgeLabelFill,
        labelBackground: false,
        labelPadding: 0,
        labelOffsetX: -15,
        labelOffsetY: -10,
        labelPlacement: 'end',
        labelAutoRotate: false,
      },
    },
    layout: {
      type: 'dagre',
      rankdir: 'LR', // 从左到右布局
      ranksep: 110, // 层间距（LR 方向时是水平方向相邻层间距）
      nodesep: 8, // 节点间距（LR 方向时是竖直方向间距）
      // 动态计算节点大小，根据 label 内容计算高度
      nodeSize: (node: any) => {
        if (!node || !graphInstance) return [NODE_WIDTH, NODE_MIN_HEIGHT];
        const nodeId = typeof node === 'string' ? node : node.id ?? node.data?.id;
        if (!nodeId) return [NODE_WIDTH, NODE_MIN_HEIGHT];
        try {
          const nodeData = graphInstance.getNodeData(nodeId);
          const nodeHeight = calculateNodeHeight(nodeData?.label);
          return [NODE_WIDTH, nodeHeight];
        } catch (e) {
          return [NODE_WIDTH, NODE_MIN_HEIGHT];
        }
      },
    },
    plugins: [
      function () {
        return createClickTooltipPlugin.call(this);
      },
    ],
    behaviors: ['zoom-canvas', 'drag-canvas'],
  });

  // 保存 graph 实例引用
  graphInstance = graph;
  globalGraphInstance = graph;

  const hideClickTooltip = () => {
    const clickTooltip = graph.getPluginInstance(CLICK_TOOLTIP_KEY) as any;
    clickTooltip?.hide?.();
  };

  graph.once(GraphEvent.AFTER_RENDER, () => {
    graph.fitView();
  });

  // 监听节点展开/收起事件，更新 HTML 内容并触发动画
  // 参考：https://g6.antv.antgroup.com/manual/animation/custom-animation
  const handleNodeExpandCollapse = async (nodeId: string) => {
    setTimeout(async () => {
      try {
        const nodeData = graph.getNodeData(nodeId);
        if (nodeData) {
          // 使用 updateNodeData 数组形式更新节点数据，参考文档示例
          graph.updateNodeData([{
            ...nodeData,
          }]);
          // 调用 draw() 触发更新动画（节点的 update 动画配置会让位置变化有平滑过渡）
          await graph.draw();
        }
      } catch (e) {
        console.error('Error updating node after expand/collapse:', e);
      }
    }, 50);
  };

  graph.on('node:collapse', (evt: any) => {
    const nodeId = evt?.item?.id || evt?.id;
    if (nodeId) {
      handleNodeExpandCollapse(nodeId);
    }
  });

  graph.on('node:expand', (evt: any) => {
    const nodeId = evt?.item?.id || evt?.id;
    if (nodeId) {
      handleNodeExpandCollapse(nodeId);
    }
  });

  graph.on('tooltip:show', (evt: any) => {
    if (!evt) return;
    const sourceEvent = evt?.originalEvent ?? evt?.event ?? evt;
    if (isCollapseTarget(sourceEvent)) {
      evt?.preventDefault?.();
      hideClickTooltip();
    }
  });

  graph.on('canvas:click', () => {
    hideClickTooltip();
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
  background-image: radial-gradient(#dbe1f5 1.5px, transparent 2px);
  background-size: 26px 26px;
}

.dark #container {
  background: #09101F;
  background-image: radial-gradient(#3d4a647e 1.5px, transparent 2px);
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
