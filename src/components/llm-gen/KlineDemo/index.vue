<template>
  <div ref="chartRef" style="height: 400px"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';

// 定义Props类型
interface Annotation {
  type?: string;
  timestamp: number;
  text: string;
  subText?: string;
  style?: 'primary' | 'success' | 'warning';
  xAxisText?: string;
}

interface Region {
  startTimestamp: number;
  endTimestamp: number;
  text?: string;
  color?: string;
}

interface KlineDemoProps {
  params?: {
    view?: {
      main?: {
        layers?: any[];
      };
    };
    apis?: any[];
    [key: string]: any;
  };
  data?: any;
}

const props = defineProps<KlineDemoProps>();

// 从 params.view.main.layers 中提取配置
const getLayerValue = (name: string, defaultValue: any = null) => {
  const layers = props.params?.view?.main?.layers;
  if (!layers || !Array.isArray(layers)) return defaultValue;

  // 遍历 layers 查找对应的参数
  for (const layer of layers) {
    if (layer.name === name && layer.value !== undefined) {
      return layer.value;
    }
    // 也检查直接属性
    if (layer[name] !== undefined) {
      return layer[name];
    }
  }

  return defaultValue;
};

// 计算属性获取配置
const stockCode = computed(() => getLayerValue('stockCode', '300033'));
const stockMarket = computed(() => getLayerValue('stockMarket', '33'));
const annotations = computed<Annotation[]>(() => getLayerValue('annotations', []));
const regions = computed<Region[]>(() => getLayerValue('regions', []));
const showDataZoom = computed(() => getLayerValue('showDataZoom', true));
const chartTitle = computed(() => getLayerValue('title', ''));

const chartRef = ref<HTMLElement | null>(null);
let chart: any = null;

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });

// 注册自定义标签覆盖物
const registerCustomOverlays = () => {
  const HXKlineChart = (window as any).HXKlineChart;
  if (!HXKlineChart) return;

  try {
    // 事件标签覆盖物 - 带连接线的标签
    HXKlineChart.registerOverlay({
      name: 'eventTag',
      totalStep: 2,
      needDefaultPointFigure: false,
      needDefaultXAxisFigure: true,
      createPointFigures: ({ overlay, coordinates, bounding }: any) => {
        const { extendData } = overlay;
        if (!extendData || coordinates.length === 0) return [];

        const { text, subText, style = 'primary', offsetY = 0 } = extendData;
        const coord = coordinates[0];

        // 样式配置
        const styleConfig: Record<string, { bgColor: string; textColor: string }> = {
          primary: { bgColor: '#EF5350', textColor: '#fff' },
          success: { bgColor: '#26A69A', textColor: '#fff' },
          warning: { bgColor: '#FF9800', textColor: '#fff' },
        };
        const colors = styleConfig[style] || styleConfig.primary;

        const figures: any[] = [];
        const padding = 5;
        const fontSize = 11;
        const lineHeight = 16;

        // 计算文本宽度 - 根据字符类型估算
        const getTextWidth = (str: string) => {
          if (!str) return 0;
          let width = 0;
          for (const char of str) {
            // 中文和特殊字符宽度较大
            width += /[\u4e00-\u9fa5→]/.test(char) ? fontSize : fontSize * 0.55;
          }
          return width;
        };
        const mainTextLen = getTextWidth(text || '');
        const subTextLen = getTextWidth(subText || '');
        const textWidth = Math.max(mainTextLen, subTextLen, 45) + padding * 2;
        const boxHeight = subText ? lineHeight * 2 + padding : lineHeight + padding;

        // 标签位置 - 根据K线位置智能调整，避免超出边界
        const tagY = Math.max(25, Math.min(coord.y - 50 - offsetY * 0.8, 180));
        const chartWidth = bounding?.width || 800;
        const tagX = Math.max(textWidth / 2 + 5, Math.min(coord.x, chartWidth - textWidth / 2 - 5));

        // 主标签背景
        figures.push({
          type: 'rect',
          attrs: {
            x: tagX - textWidth / 2,
            y: tagY,
            width: textWidth,
            height: boxHeight,
          },
          styles: {
            style: 'fill',
            color: colors.bgColor,
            borderRadius: 4,
          },
        });

        // 主标签文字
        figures.push({
          type: 'text',
          attrs: {
            x: tagX,
            y: tagY + padding + fontSize / 2 - 4,
            text: text || '',
            align: 'center',
            baseline: 'middle',
          },
          styles: {
            color: colors.textColor,
            size: fontSize,
            family: 'PingFang SC, Microsoft YaHei, sans-serif',
          },
        });

        // 子标签文字（如进展百分比）
        if (subText) {
          figures.push({
            type: 'text',
            attrs: {
              x: tagX,
              y: tagY + padding + lineHeight + fontSize / 2 - 4,
              text: subText,
              align: 'center',
              baseline: 'middle',
            },
            styles: {
              color: colors.textColor,
              size: fontSize,
              family: 'PingFang SC, Microsoft YaHei, sans-serif',
            },
          });
        }

        // 连接线 - 从标签底部到K线顶部
        figures.push({
          type: 'line',
          attrs: {
            coordinates: [
              { x: tagX, y: tagY + boxHeight },
              { x: coord.x, y: 400 },
            ],
          },
          styles: {
            style: 'solid',
            color: colors.bgColor,
            size: 1,
          },
        });

        return figures;
      },
      createXAxisFigures: ({ overlay, coordinates }: any) => {
        const { extendData } = overlay;
        if (!extendData || coordinates.length === 0) return [];

        const coord = coordinates[0];
        const { xAxisText, style = 'primary' } = extendData;
        if (!xAxisText) return [];

        const styleConfig: Record<string, { bgColor: string }> = {
          primary: { bgColor: '#EF5350' },
          success: { bgColor: '#26A69A' },
          warning: { bgColor: '#FF9800' },
        };
        const colors = styleConfig[style] || styleConfig.primary;

        return [
          {
            type: 'rectText',
            attrs: {
              x: coord.x,
              y: 0,
              text: xAxisText,
              align: 'center',
              baseline: 'top',
            },
            styles: {
              style: 'fill',
              color: '#fff',
              backgroundColor: colors.bgColor,
              borderRadius: 2,
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 2,
              paddingBottom: 2,
              size: 10,
            },
          },
        ];
      },
    });

    // 区域标记覆盖物
    HXKlineChart.registerOverlay({
      name: 'regionMark',
      totalStep: 3,
      needDefaultPointFigure: false,
      createPointFigures: ({ overlay, coordinates, bounding }: any) => {
        const { extendData } = overlay;
        if (coordinates.length < 2) return [];

        const { text, color = 'rgba(239, 83, 80, 0.08)' } = extendData || {};
        const [start, end] = coordinates;

        const figures: any[] = [];
        const height = bounding?.height || 500;

        // 区域背景 - 覆盖整个高度
        figures.push({
          type: 'rect',
          attrs: {
            x: Math.min(start.x, end.x),
            y: 0,
            width: Math.abs(end.x - start.x),
            height: height,
          },
          styles: {
            style: 'fill',
            color: color,
          },
        });

        // 区域标签
        if (text) {
          // 根据字符类型估算宽度
          let textWidth = 16;
          for (const char of text) {
            textWidth += /[\u4e00-\u9fa5]/.test(char) ? 12 : 7;
          }
          figures.push({
            type: 'rect',
            attrs: {
              x: (start.x + end.x) / 2 - textWidth / 2,
              y: 10,
              width: textWidth,
              height: 22,
            },
            styles: {
              style: 'fill',
              color: '#EF5350',
              borderRadius: 4,
            },
          });
          figures.push({
            type: 'text',
            attrs: {
              x: (start.x + end.x) / 2,
              y: 18,
              text: text,
              align: 'center',
              baseline: 'middle',
            },
            styles: {
              color: '#fff',
              size: 11,
              family: 'PingFang SC, Microsoft YaHei, sans-serif',
            },
          });
        }

        return figures;
      },
    });
  } catch (e: any) {
    // 覆盖物可能已经注册，忽略错误
    console.warn('Overlay registration:', e.message);
  }
};

// 创建标注
const createAnnotations = (dataList: any[]) => {
  if (!chart || !dataList || dataList.length === 0) return;

  const annotationList = annotations.value;
  console.log('[KlineDemo] Annotations to create:', annotationList);

  if (!annotationList || annotationList.length === 0) {
    console.log('[KlineDemo] No annotations to create');
    return;
  }

  // 按时间排序标注，避免重叠
  const sortedAnnotations = [...annotationList].sort((a, b) => a.timestamp - b.timestamp);

  sortedAnnotations.forEach((annotation, index) => {
    // 找到最接近的数据点
    let targetIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < dataList.length; i++) {
      const diff = Math.abs(dataList[i].timestamp - annotation.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        targetIndex = i;
      }
    }

    if (targetIndex === -1) return;

    const targetData = dataList[targetIndex];
    if (!targetData) return;

    // 计算Y轴偏移，避免标签重叠
    const offsetY = index * 45;

    console.log(`[KlineDemo] Creating annotation ${index}:`, annotation.text, 'at index', targetIndex);

    chart.createOverlay({
      name: 'eventTag',
      id: `annotation_${index}`,
      points: [{ timestamp: targetData.timestamp, value: targetData.high * 1.02 }],
      extendData: {
        text: annotation.text,
        subText: annotation.subText,
        style: annotation.style,
        xAxisText: annotation.xAxisText,
        offsetY: offsetY,
      },
      lock: true,
      zLevel: 10 + index,
    });
  });
};

// 创建区域标记
const createRegions = (dataList: any[]) => {
  if (!chart || !dataList || dataList.length === 0) return;

  const regionList = regions.value;
  console.log('[KlineDemo] Regions to create:', regionList);

  if (!regionList || regionList.length === 0) {
    console.log('[KlineDemo] No regions to create');
    return;
  }

  regionList.forEach((region, index) => {
    // 找到最接近的起始和结束数据点
    let startIndex = -1;
    let endIndex = -1;
    let minStartDiff = Infinity;
    let minEndDiff = Infinity;

    for (let i = 0; i < dataList.length; i++) {
      const startDiff = Math.abs(dataList[i].timestamp - region.startTimestamp);
      const endDiff = Math.abs(dataList[i].timestamp - region.endTimestamp);

      if (startDiff < minStartDiff) {
        minStartDiff = startDiff;
        startIndex = i;
      }
      if (endDiff < minEndDiff) {
        minEndDiff = endDiff;
        endIndex = i;
      }
    }

    if (startIndex === -1 || endIndex === -1) return;

    const startData = dataList[startIndex];
    const endData = dataList[endIndex];
    if (!startData || !endData) return;

    console.log(`[KlineDemo] Creating region ${index}: from`, startIndex, 'to', endIndex);

    chart.createOverlay({
      name: 'regionMark',
      id: `region_${index}`,
      points: [
        { timestamp: startData.timestamp, value: startData.high },
        { timestamp: endData.timestamp, value: endData.high },
      ],
      extendData: {
        text: region.text,
        color: region.color || 'rgba(239, 83, 80, 0.08)',
      },
      lock: true,
      zLevel: -1,
    });
  });
};

onMounted(async () => {
  console.log('[KlineDemo] Component mounted, props:', props);
  console.log('[KlineDemo] Layers:', props.params?.view?.main?.layers);

  await loadScript('https://s.thsi.cn/cd/b2cweb-component-hxklinechart-front/index.2.1.10.js');
  await loadScript('https://s.thsi.cn/cd/b2cweb-component-hxkline-front/index.1.2.12.js');

  const HXKline = (window as any).HXKline;
  if (!HXKline) {
    console.error('[KlineDemo] HXKline not loaded');
    return;
  }

  // 注册自定义覆盖物
  registerCustomOverlays();

  HXKline.verifyProjectPermission({
    id: 'hxkline-test',
    token:
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRob3JpemVyX25hbWVzcGFjZSI6ImNvbW1vbi1ocS1hZ2dyIiwibGljZW5zZWVfdHlwZSI6IkZST05UX0FQUCIsImxpY2Vuc2VlX25hbWVzcGFjZSI6Imh4a2xpbmUtdGVzdCJ9.W2sg74tpiTpTNv0X-94WkrXJqOJK8BgV4479GmDNOvY',
  });

  const stockInfo = {
    code: stockCode.value,
    market: stockMarket.value,
    data_class: 'kline',
    time_period: 'day_1',
    trade_date: 0,
  };

  console.log('[KlineDemo] Stock info:', stockInfo);
  console.log('[KlineDemo] Annotations config:', annotations.value);
  console.log('[KlineDemo] Regions config:', regions.value);

  // 图表样式配置
  const chartStyles = {
    // 背景色
    container: {
      backgroundColor: 'transparent',
    },
    // Y轴在图表内部
    yAxis: {
      inside: true,
    },
    // 蜡烛图样式（红涨绿跌）
    candle: {
      bar: {
        upColor: '#EF5350',
        downColor: '#26A69A',
        noChangeColor: '#888888',
        upBorderColor: '#EF5350',
        downBorderColor: '#26A69A',
        noChangeBorderColor: '#888888',
        upWickColor: '#EF5350',
        downWickColor: '#26A69A',
        noChangeWickColor: '#888888',
      },
      priceMark: {
        show: false,
        high: { show: false },
        low: { show: false },
        last: { show: false },
      },
      tooltip: {
        showRule: 'none',
      }
    },
    // 网格线
    grid: {
      show: true,
      horizontal: {
        show: true,
        color: '#EDEDED',
        style: 'dashed',
      },
      vertical: {
        show: true,
        color: '#EDEDED',
        style: 'dashed',
      },
    },
    // X轴样式
    xAxis: {
      show: true,
      tickText: {
        show: true,
        color: '#76808F',
        size: 10,
      },
    },
  };

  chart = HXKline.initChart(
    chartRef.value,
    stockInfo,
    { styles: chartStyles },
    (type: string) => {
      if (type === 'success') {
        console.log('[KlineDemo] Chart initialized successfully');

        // 获取数据并创建标注
        setTimeout(() => {
          const dataList = chart.getDataList();
          console.log('[KlineDemo] Data list length:', dataList?.length);

          if (dataList && dataList.length > 0) {
            createRegions(dataList);
            createAnnotations(dataList);
          }
          // 显示完整数据范围
          chart.zoomToShowAllData();
        }, 200);
      }
    }
  );
});

onBeforeUnmount(() => {
  chart?.dispose?.();
});
</script>

<style scoped>
/* 容器样式 */
</style>
