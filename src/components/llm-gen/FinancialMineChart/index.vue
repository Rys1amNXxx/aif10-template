<template>
  <div ref="wrapperRef"
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
      <p>· 数据取自董事会经营综述、研报和财报经营数据</p>
      <p>· 内容由 AI 生成</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center z-20">
      <div class="text-[#768496] black:text-text-02-01-dark">加载中...</div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error && !loading" class="absolute inset-0 flex items-center justify-center z-20">
      <div class="text-[#FD2033] text-sm">{{ error }}</div>
    </div>

    <!-- G6 容器 -->
    <div id="container"></div>

    <!-- 自定义 Tooltip（完全脱离 G6 插件） -->
    <Transition name="tooltip-fade" mode="out-in">
      <div v-if="tooltip.visible" :key="tooltip.key" class="g6-custom-tooltip" :style="tooltipStyle"
        @mouseenter="handleTooltipMouseEnter" @mouseleave="handleTooltipMouseLeave" @wheel="handleTooltipWheel"
        @mousewheel="handleTooltipWheel" @DOMMouseScroll="handleTooltipWheel">
        <div class="g6-custom-tooltip-inner" v-html="tooltip.html"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useDark } from '@vueuse/core';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';
import ResetIcon from '@/components/icons/Reset.vue';
import ZoomInIcon from '@/components/icons/zoomIn.vue';
import ZoomOutIcon from '@/components/icons/zoomOut.vue';
import { Graph, GraphEvent, iconfont, treeToGraphData } from '@antv/g6';
import localConfigData from './config.json';

// Props 定义
interface Props {
  params: {
    apis: Array<{
      method: string;
      isFirstScreen: boolean;
      alias: string;
      url: string;
      params: Record<string, any>;
      depends?: string[];
    }>;
    view?: any[];
    token?: string;
    hook?: Function;
    [key: string]: any;
  };
  data?: any;
}

const props = withDefaults(defineProps<Props>(), {
  params: () => localConfigData as any,
  data: undefined
});

// 获取 URL 参数（提供默认值以支持开发环境）
const code = window.F10Utils.getUrlParams('code') || '300033';
const market = window.F10Utils.getUrlParams('market') || '33';
const seq = window.F10Utils.getUrlParams('seq') || '';

// 生成组件唯一ID
const componentId = `chart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// 主题监听
const isDark = useDark();

// 数据存储
const chartData = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// 外层容器引用（用来算 tooltip 的相对位置）
const wrapperRef = ref<HTMLElement | null>(null);

// tooltip 状态
const tooltip = ref<{
  visible: boolean;
  x: number;
  y: number;
  html: string;
  nodeId: string | null;
  key: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  html: '',
  nodeId: null,
  key: 0,
});

// 标记鼠标是否在 tooltip 上
const isMouseOverTooltip = ref(false);
// 标记是否正在惯性滚动（防止滚动惯性穿透）
const isInertiaScrolling = ref(false);
let inertiaTimeout: number | null = null;

// tooltip 在容器内的样式（带边界裁剪）
const TOOLTIP_VIEW_PADDING = 12;
const tooltipStyle = computed(() => {
  const wrapper = wrapperRef.value;
  if (!wrapper || !tooltip.value.visible) return { display: 'none' };

  const rect = wrapper.getBoundingClientRect();
  const padding = TOOLTIP_VIEW_PADDING;
  const maxWidth = 360;
  const half = maxWidth / 2;

  // const desiredLeft = tooltip.value.x - half;
  let left = tooltip.value.x;
  let top = tooltip.value.y;

  // 左边界裁剪
  if (left < padding) {
    left = padding;
  }
  // 右边界裁剪
  if (left + maxWidth > rect.width - padding) {
    left = rect.width - padding - maxWidth;
  }

  // 垂直简单约束一下，避免跑出容器上下边缘
  const offsetY = -10;
  if (top < padding + 60) {
    top = padding + 60;
  }
  if (top > rect.height - padding - 60) {
    top = rect.height - padding - 60;
  }

  return {
    left: `${left}px`,
    top: `${top - offsetY}px`,
  };
});

//测试开关：设置为 true 使用本地 mock 数据，false 使用接口数据
const USE_LOCAL_DATA = false;
// 是否首次渲染标记
const isFirstRender = ref(true);

// 获取接口数据
const fetchChartData = async () => {
  // 如果有传入的初始数据，优先使用（包括刷新时）
  if (props.data) {
    // props.data 的结构是 { financialMineChart: { rows: [...] } }
    // 需要提取 financialMineChart.rows[0].data
    const apiData = props.data.financialMineChart;
    if (apiData?.rows?.[0]?.data) {
      chartData.value = apiData.rows[0].data;
    } else {
      // 降级：尝试直接使用 data（如果是旧格式）
      chartData.value = props.data;
      console.warn('[FinancialMineChart] 数据格式不匹配，使用原始数据');
    }

    if (isFirstRender.value) {
      isFirstRender.value = false;
    }
    return;
  }

  // 如果使用本地数据，直接使用 config.json 的 mockData
  if (USE_LOCAL_DATA) {
    loading.value = false;
    chartData.value = (localConfigData as any).mockData || localConfigData;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const api = props.params.apis?.find(api => api.alias === 'financialMineChart');
    if (!api) {
      console.error('[FinancialMineChart] 未找到 API 配置');
      error.value = '配置错误：未找到 API 配置';
      return;
    }

    const url = processUrl(api.url);
    const method = api.method.toLowerCase();

    // 使用 processParams 处理配置中的参数，自动替换 ${code} 和 ${market}
    const requestBody = processParams(api.params || {});

    const response = await axios({
      method,
      url,
      params: method === 'get' ? requestBody : undefined,
      data: method !== 'get' ? requestBody : undefined
    });

    if (response.data.status_code === 0 || response.data.status_code === 200) {
      // 根据新的数据结构提取图谱数据：data.rows[0].data
      const resultData = response.data?.data?.rows?.[0]?.data;

      if (resultData) {
        chartData.value = resultData;
      } else {
        error.value = '数据格式错误，未找到图谱数据';
        console.error('[FinancialMineChart] 数据结构异常:', response.data);
      }
    } else {
      error.value = response.data.status_msg || '数据加载失败';
      console.error('[FinancialMineChart] 请求失败:', response.data);
    }
  } catch (err: any) {
    error.value = err.message || '网络请求失败，请稍后重试';
    console.error('[FinancialMineChart] 请求异常:', err);
  } finally {
    loading.value = false;
  }
};

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
      // 潜力孵化业务
      tagPotentialBg: 'rgba(7, 171, 75, 0.12)',
      tagPotentialText: '#07AB4B',
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
      // 潜力孵化业务
      tagPotentialBg: 'rgba(7, 171, 75, 0.12)',
      tagPotentialText: '#07AB4B',
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

// 引入 iconfont（如果后续有图标文字可以继续用）
const style = document.createElement('style');
style.innerHTML = `@import url('${iconfont.css}');`;
document.head.appendChild(style);

const TITLE_TAG_GAP = 6;
const TAG_HORIZONTAL_PADDING = 12;
const TAG_VERTICAL_PADDING = 9;
const DETAIL_ICON_SIZE = 14;
const DETAIL_ICON_GAP = 4;

const NODE_WIDTH = 300;
const NODE_MIN_HEIGHT = 72;
const LABEL_FONT_SIZE = 14;
const LABEL_LINE_HEIGHT = 20;
const LABEL_BOTTOM_MARGIN = 10;
const TITLE_LABEL_GAP = 8;
const LABEL_LEFT_PADDING = 27;
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
    const charWidth = code > 255 ? fontSize : fontSize * 0.6;

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

  const labelAreaHeight = labelLines * LABEL_LINE_HEIGHT;
  const calculatedHeight =
    TITLE_AREA_HEIGHT + TITLE_LABEL_GAP + labelAreaHeight + LABEL_BOTTOM_MARGIN;
  return Math.max(calculatedHeight, NODE_MIN_HEIGHT);
};

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDetailToHtml = (detail: string) => {
  if (!detail) return '';

  // 处理多种换行符格式
  const normalized = String(detail)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n');

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map(
      (line) =>
        `<div style="margin-bottom: 4px;">${escapeHtml(line)}</div>`,
    )
    .join('');
};
// 全局变量存储 graph 实例引用（用于事件处理函数）
let globalGraphInstance: Graph | null = null;

// 生成节点 HTML 内容的函数
const generateNodeHTML = (nodeData: any, isExpanded: boolean, hasChildren: boolean) => {
  const width = NODE_WIDTH;
  const height = calculateNodeHeight(nodeData.label);
  const colors = themeColors.value;
  const basePadding = 10;
  const iconOffset = DETAIL_ICON_SIZE + DETAIL_ICON_GAP;
  const availableWidth = width - (basePadding + iconOffset) - 20;

  const depth = nodeData?.style?.depth ?? nodeData?.depth ?? 0;
  const fontWeight = depth >= 2 ? 400 : 600;

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

  const detailIconStyle = `
    position: absolute;
    left: ${basePadding}px;
    top: ${titleTop + 3}px;
    width: ${DETAIL_ICON_SIZE}px;
    height: ${DETAIL_ICON_SIZE}px;
    cursor: pointer;
  `;

  // 标签（如果有）
  let tagHTML = '';
  if (nodeData.tag) {
    const tagText = escapeHtml(String(nodeData.tag));
    const isCoreCashCow = tagText === '核心现金牛';
    const isPotential = tagText === '潜力孵化业务';

    let tagBg = colors.tagNormalBg;
    let tagTextColor = colors.tagNormalText;

    if (isCoreCashCow) {
      tagBg = colors.tagSpecialBg;
      tagTextColor = colors.tagSpecialText;
    } else if (isPotential) {
      tagBg = colors.tagPotentialBg;
      tagTextColor = colors.tagPotentialText;
    }

    const estimateTitleWidth = (text: string) => {
      let width = 0;
      for (const char of text) {
        const code = char.charCodeAt(0);
        width += code > 255 ? 14 : 8.4;
      }
      return Math.min(width, availableWidth);
    };
    const titleWidth = estimateTitleWidth(nodeData.name || '');

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
    const collapseIcon = isExpanded
      ? `<line x1="3" y1="9" x2="15" y2="9" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />`
      : `<line x1="3" y1="9" x2="15" y2="9" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />
         <line x1="9" y1="3" x2="9" y2="15" stroke="${collapseIconColor}" stroke-width="1.6" stroke-linecap="round" />`;

    collapseButtonHTML = `
      <div class="collapse-button" style="${collapseButtonStyle}" onclick="handleCollapseClick_${componentId}('${nodeData.id}')">
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
      <div class="detail-icon" style="${detailIconStyle}" onclick="handleDetailIconClick_${componentId}(event, '${nodeData.id}')">
        ${detailIconSVG}
      </div>
      
      <!-- 标题文本 -->
      <div class="detail-title" style="${titleStyle}" onclick="handleTitleClick_${componentId}(event, '${nodeData.id}')">
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

// 公共 tooltip 展示逻辑（标题 & icon 共用）
const commonShowDetailTooltip = (event: MouseEvent, nodeId: string) => {
  event.stopPropagation();
  event.preventDefault();
  if (!globalGraphInstance) return;

  const nodeData = globalGraphInstance.getNodeData(nodeId);
  if (!nodeData?.detail) return;

  const wrapper = wrapperRef.value;
  if (!wrapper) return;

  const wrect = wrapper.getBoundingClientRect();

  // 把浏览器坐标转换为 wrapper 内部坐标
  const localX = event.clientX - wrect.left;
  const localY = event.clientY - wrect.top;

  const isSameNode =
    tooltip.value.visible && tooltip.value.nodeId === nodeId;

  tooltip.value = {
    visible: true,
    x: localX,
    y: localY,
    html: `
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">节点描述</div>
      ${formatDetailToHtml(String(nodeData.detail))}
    `,
    nodeId,
    key: isSameNode ? tooltip.value.key : tooltip.value.key + 1,
  };
};

const hideTooltip = () => {
  // 如果鼠标在 tooltip 上，不关闭
  if (isMouseOverTooltip.value) {
    return;
  }
  tooltip.value.visible = false;
};

// Tooltip 鼠标进入
const handleTooltipMouseEnter = () => {
  isMouseOverTooltip.value = true;
};

// Tooltip 鼠标离开
const handleTooltipMouseLeave = () => {
  isMouseOverTooltip.value = false;
  // 不主动清除惯性状态，让定时器自然过期
};

// Tooltip 内滚轮事件处理
const handleTooltipWheel = (e: WheelEvent) => {
  // 阻止当前事件冒泡
  e.stopPropagation();

  // 开启惯性保护
  isInertiaScrolling.value = true;

  // 重置定时器
  if (inertiaTimeout !== null) {
    clearTimeout(inertiaTimeout);
  }

  // 设定较长的缓冲时间（400ms），在这个时间内，Canvas 禁止缩放
  inertiaTimeout = window.setTimeout(() => {
    isInertiaScrolling.value = false;
    inertiaTimeout = null;
  }, 400);
};

// 容器级捕获阶段拦截器：防止滚动惯性穿透到 Canvas
const handleContainerCaptureWheel = (e: WheelEvent) => {
  // 如果处于 Tooltip 滚动带来的惯性期
  if (isInertiaScrolling.value) {
    // 1. 阻止事件向下传递给 G6 Canvas
    e.stopPropagation();
    e.stopImmediatePropagation();
    // 2. 阻止浏览器默认滚动行为
    e.preventDefault();
  }
};

// 使用唯一ID注册全局函数，避免命名冲突
(window as any)[`handleDetailIconClick_${componentId}`] = (event: MouseEvent, nodeId: string) => {
  commonShowDetailTooltip(event, nodeId);
};

(window as any)[`handleTitleClick_${componentId}`] = (event: MouseEvent, nodeId: string) => {
  commonShowDetailTooltip(event, nodeId);
};

(window as any)[`handleCollapseClick_${componentId}`] = async (nodeId: string) => {
  if (!globalGraphInstance) return;

  try {
    const nodeData = globalGraphInstance.getNodeData(nodeId);
    const collapsed = nodeData?.style?.collapsed ?? false;

    if (collapsed) {
      globalGraphInstance.expandElement(nodeId);
    } else {
      globalGraphInstance.collapseElement(nodeId);
    }

    setTimeout(async () => {
      const updatedNodeData = globalGraphInstance?.getNodeData(nodeId);
      if (updatedNodeData) {
        globalGraphInstance?.updateNodeData([
          {
            ...updatedNodeData,
          },
        ]);
        await globalGraphInstance?.draw();
      }
    }, 50);
  } catch (e) {
    console.error('[FinancialMineChart] 展开/折叠节点失败:', e);
  }
};

const graphRef = ref<Graph | null>(null);

const initGraph = () => {
  // 不在这里请求数据，只使用已有 chartData
  if (!chartData.value) {
    console.error('[FinancialMineChart] 无法初始化图表：数据为空');
    return;
  }

  let graphInstance: Graph | null = null;

  const nodeHasChildrenMap = new Map<string, boolean>();

  const buildNodeMaps = (node: any) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    nodeHasChildrenMap.set(node.id, hasChildren);
    if (hasChildren) {
      node.children.forEach((child: any) => buildNodeMaps(child));
    }
  };
  buildNodeMaps(chartData.value);

  const graph = new Graph({
    container: 'container',
    animation: COLLAPSE_EXPAND_ANIMATION,
    data: treeToGraphData(chartData.value, {
      getNodeData: (datum: any, depth: number) => {
        if (!datum.style) datum.style = {};
        datum.style.depth = depth;

        const nodeHeight = calculateNodeHeight(datum.label);
        datum.style.size = [NODE_WIDTH, nodeHeight];

        datum.style.collapsed = depth >= 5;
        if (typeof datum.style.expanded === 'undefined') {
          datum.style.expanded = false;
        }
        if (!datum.children) return datum as any;
        const { children, ...restDatum } = datum;
        return { ...restDatum, children: children.map((child: any) => child.id) } as any;
      },
      getEdgeData: (source, target) => {
        const rate = target?.rate;
        const edgeData: any = {
          source: source.id,
          target: target.id,
          sourcePort: 'right',
          targetPort: 'left',
        };
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
        dx: () => -NODE_WIDTH / 2,
        dy: (d: any) => {
          const nodeId = d.id;
          const nodeData = graphInstance?.getNodeData(nodeId) || d.data || d;
          const nodeHeight = calculateNodeHeight(nodeData.label);
          return -nodeHeight / 2;
        },
        ports: [
          { placement: 'right' },
          { placement: 'left' },
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
        labelOffsetX: -10,
        labelOffsetY: -10,
        labelPlacement: 'end',
        labelAutoRotate: false,
      },
    },
    layout: {
      type: 'dagre',
      rankdir: 'LR',
      ranksep: 125,
      nodesep: 8,
      nodeSize: (node: any) => {
        if (!node || !graphInstance) return [NODE_WIDTH, NODE_MIN_HEIGHT];
        const nodeId = typeof node === 'string' ? node : node.id ?? node.data?.id;
        if (!nodeId) return [NODE_WIDTH, NODE_MIN_HEIGHT];
        try {
          const nodeData = graphInstance.getNodeData(nodeId);
          const nodeHeight = calculateNodeHeight(nodeData?.label as string | undefined);
          return [NODE_WIDTH, nodeHeight];
        } catch (e) {
          return [NODE_WIDTH, NODE_MIN_HEIGHT];
        }
      },
    },
    behaviors: ['zoom-canvas', 'drag-canvas'],
  });

  graphInstance = graph;
  globalGraphInstance = graph;

  graph.once(GraphEvent.AFTER_RENDER, () => {
    graph.fitView();
  });

  const handleNodeExpandCollapse = async (nodeId: string) => {
    setTimeout(async () => {
      try {
        const nodeData = graph.getNodeData(nodeId);
        if (nodeData) {
          graph.updateNodeData([
            {
              ...nodeData,
            },
          ]);
          await graph.draw();
        }
      } catch (e) {
        console.error('[FinancialMineChart] 更新节点失败:', e);
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

  graph.on('canvas:click', () => {
    // 强制关闭 tooltip
    isMouseOverTooltip.value = false;
    tooltip.value.visible = false;
  });

  graph.on(GraphEvent.AFTER_TRANSFORM, () => {
    // 视图变换时关闭 tooltip（不受惯性状态影响）
    hideTooltip();
  });

  graph.render();
  graphRef.value = graph;
};

const handleRefresh = async () => {
  // 强制关闭 tooltip 并重置状态
  isMouseOverTooltip.value = false;
  tooltip.value.visible = false;

  await fetchChartData();
  if (graphRef.value) {
    graphRef.value.destroy();
    graphRef.value = null;
  }
  // 清空容器，确保旧的画布元素被完全移除
  const container = document.getElementById('container');
  if (container) {
    container.innerHTML = '';
  }
  initGraph();
};

const handleZoom = (ratio: number) => {
  const graph = graphRef.value;
  if (!graph) return;
  graph.zoomBy(ratio, undefined, graph.getViewportCenter());
};

onMounted(async () => {
  await fetchChartData();
  initGraph();

  // 添加捕获阶段的监听器，防止滚动惯性穿透
  if (wrapperRef.value) {
    wrapperRef.value.addEventListener('wheel', handleContainerCaptureWheel, { capture: true });
  }
});

onBeforeUnmount(() => {
  // 移除捕获监听器
  if (wrapperRef.value) {
    wrapperRef.value.removeEventListener('wheel', handleContainerCaptureWheel, { capture: true });
  }

  if (graphRef.value) {
    graphRef.value.destroy();
    graphRef.value = null;
  }

  const win = window as any;
  // 使用唯一ID清理对应的全局函数，避免内存泄漏
  delete win[`handleDetailIconClick_${componentId}`];
  delete win[`handleTitleClick_${componentId}`];
  delete win[`handleCollapseClick_${componentId}`];

  // 清理惯性滚动定时器
  if (inertiaTimeout !== null) {
    clearTimeout(inertiaTimeout);
    inertiaTimeout = null;
  }

  // 清空容器，确保旧的画布元素被完全移除
  const container = document.getElementById('container');
  if (container) {
    container.innerHTML = '';
  }
});

// 监听外部数据变化
watch(() => props.data, (newVal) => {
  if (newVal) {
    chartData.value = newVal;
    initGraph();
  }
}, { deep: true });

// 监听主题变化
watch(isDark, () => {
  handleRefresh();
});
</script>

<style scoped>
#container {
  width: 100%;
  height: 520px;
  border-radius: 16px;
  background: #f2f5fa;
  background-image: radial-gradient(#dbe1f5 1.5px, transparent 2px);
  background-size: 26px 26px;
}

.dark #container {
  background: #09101f;
  background-image: radial-gradient(#3d4a647e 1.5px, transparent 2px);
  background-size: 26px 26px;
  border-radius: 16px;
}

:deep(.detail-title:hover) {
  color: #5261a7 !important;
  text-decoration: underline;
  opacity: 1 !important;
}

/* 自定义 Tooltip 样式 */
.g6-custom-tooltip {
  position: absolute;
  z-index: 9999;
  pointer-events: auto;
}

.g6-custom-tooltip-inner {
  background: #000000d9;
  border-radius: 8px;
  padding: 12px 16px;
  max-width: 360px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  font-size: 14px;
  line-height: 1.6;
  color: #ffffff;
}

/* 优化 tooltip 滚动条样式 */
.g6-custom-tooltip-inner::-webkit-scrollbar {
  width: 6px;
}

.g6-custom-tooltip-inner::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.g6-custom-tooltip-inner::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.g6-custom-tooltip-inner::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
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

/* 进入 / 离开过渡动画 */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.12s cubic-bezier(0.2, 0.8, 0.4, 1),
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

.tooltip-fade-enter-to,
.tooltip-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
