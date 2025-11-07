import type { InputData, Section, View } from '@/common/models/recommend-result';
import { computed, ref, type Ref } from 'vue';
import AigcDataVisParam from '@/common/config/aigcdatavis'
import { useAppInfoStore } from '@/stores/app';
import type { Stock, ComponentRenderReturn } from '@/common/models/component-render'
import { useLLMCompRender } from './llm-comp-render';

// 数据校验（基本校验，后续可能会返回失败原因）
function verifierData(view: View, visualIndex: number) {
  if (!view) {
    return false;
  }
  // 高定模块暂不处理
  if (view.type === 'fix') {
    return false;
  }
  // 无推荐组件视图
  if (!view.visual) {
    return false;
  }
  // 推荐组件为空
  if (view!.visual && !view.visual.output.length) {
    return false;
  }

  // 数据为空
  if (view.visual && view.visual.output[visualIndex].type === 'default' && !view.visual.data.length) {
    return false;
  }
  
  return true;
}

function chartClick(clickEvent: { type: string, data: any }, section: Section, metadata: InputData, renderPosition: string, extension: any) {
  console.log('chartClick', clickEvent)
}

/**
 * 格式化参数
 * @param el 挂载元素
 * @param section 模块数据
 * @param skin 主题色
 * @param size 尺寸
 * @param view 渲染视图
 * @param visualIndex 渲染组件索引
 * @param fitHeight 是否自适应高度
 * @param fullWidth 是否通栏
 * @param renderPosition 渲染位置
 * @returns 
 */
function formatParams(el: HTMLElement,
  section: Section,
  skin: string,
  view: View,
  visualIndex: number,
  fitHeight: boolean,
  fullWidth: boolean,
  renderPosition: string
) {

  // 组件布局
  const layout = 'sm-2*1';

  // 组件信息
  const visual = view.visual;
  const compInfo = view.visual.output[visualIndex];

  // 整合组件信息
  let stocks: Stock[] = [];

  // 组件宽高设置
  let maxHeight = fitHeight ? 536 : 212;
  let width = fullWidth ? 912 : 436;

  // 右侧会话面板宽度设置
  if (renderPosition === 'copilot') {
    width = 309
    maxHeight = 200
  }

  // 如果是主副图或K线图，需要传入股票信息
  if (section.kline || compInfo.extension?.kline) {
    stocks = section.stock_meta.map(stock => {
      const { stock_code, stock_name, market_id } = stock;
      return {
        code: stock_code,
        name: stock_name,
        market: market_id
      }
    })
  }

  const customEvent = (data: { type: string; data: any }) =>
    chartClick(data, section, view.visual.input, renderPosition, compInfo.extension)

  const layers = compInfo.parameter.map((item) => {
    return {
      maxHeight,
      width,
      ...item,
      stocks,
      customEvent,
      ...compInfo.extension?.chartOptions,
    }
  })

  // 主图设置
  const chartView: { main: any; secondary?: any } = {
    main: {
      layers,
      dvInsight: [],
      ...compInfo.style
    }
  };

  // 副图设置
  if (stocks.length > 0 && section.kline) {
    chartView.secondary = {
      layers: [{
        type: 'simpleKline',
        stocks
      }]
    }
  }

  // 新格式
  const params: any = {
    data: [{
      values: JSON.parse(JSON.stringify(visual.data)),
      metadata: view.visual.input
    }],
    view: chartView,
    dom: el,
    layout,
    hook: AigcDataVisParam.hook,
    token: window.AIGCDataVis.presetThemeBuilder(skin),
    amisConfig: compInfo.extension?.amisConfig || {},
    apis: compInfo.extension?.apis || [],
    customEvent,
  }

  return params;
}

/**
 * 卡片组件渲染器
 * @param el 元素dom
 * @param section 模块数据
 * @param skin 当前echart主题
 * @param size 卡片尺寸
 * @param renderPosition 渲染位置 copilot 会话框| page 页面容器
 * @returns ComponentRenderReturn
 */
export function useComponentRender(el: Ref<HTMLElement>, section: Section, renderPosition: string): ComponentRenderReturn {

  // 内部设定高度的组件
  const fitHeightComponents = ['timeLine', 'multiTable', 'text']
  // 是否通栏
  const fullWidthComponents = ['multiTable']
  // 有本地事件的组件
  const customEventComponents = ['multiTable', 'timeLine', 'text']

  const localData = ref(section)

  // 修正视图索引
  const viewIndex = computed(() => localData.value.view_index);
  const visualIndex = computed(() => localData.value.visual_index);
  const componentInfo = computed(() => view.value?.visual.output[visualIndex.value]);

  // 视图数据(聚合视图)
  const view = computed(() => localData.value.view_wrapper?.views[viewIndex.value]);

  // 渲染器sdk选择 amis渲染器/可视化渲染器
  const renderHandler = () => {
    if (componentInfo.value?.type === 'llmgen') {
      return useLLMCompRender()
    }
    return window.AIGCDataVis
  };

  // 渲染图表
  const renderChart = () => {
    destoryChart();
    if (!isDataValid()) return
    const appStore = useAppInfoStore();
    const params = formatParams(el.value, localData.value, appStore.skin, view.value, visualIndex.value, fitHeight.value, fullWidth.value, renderPosition)
    console.log('param', params);
    renderHandler().render(el.value, { ...params, kamisToken: componentInfo.value.name })
  }

  // 切换视图索引
  const changeViewIndex = (index: number) => {
    localData.value.view_index = Number(index);
    localData.value.visual_index = 0;
    renderChart();
  }

  // 切换图表
  const changeChart = (data?: any) => {
    destoryChart()
    if (localData.value.visual_index < 0) {
      localData.value.visual_index = 0;
    }
    localData.value.visual_index++;
    if (localData.value.visual_index >= view.value.visual.output.length) {
      localData.value.visual_index = 0;
    }
    renderChart();
  }

  // 数据校验是否成功
  const isDataValid = () => {
    localData.value.view_index = Math.max(localData.value.view_index, 0);
    localData.value.visual_index = Math.max(localData.value.visual_index, 0);
    return verifierData(view.value, visualIndex.value)
  }

  // 是否支持图表切换
  const isSupportChange = () => view.value?.visual.output.length > 1

  // 销毁图表
  const destoryChart = () => {
    renderHandler().destroy(el.value)
  }

  // 是否高度自适应
  const fitHeight = computed(() => {
    if (!isDataValid()) return false
    return componentInfo.value?.extension?.fitHeight ?? fitHeightComponents.includes(componentInfo.value.name);
  })

  const fullWidth = computed(() => {
    console.log('fullWidth', localData.value.extension?.fullWidth ?? fullWidthComponents.includes(componentInfo.value?.name), localData.value.title)
    return localData.value.extension?.fullWidth ?? fullWidthComponents.includes(componentInfo.value?.name);
  })

  const loadingHeight = computed(() => {
    return localData.value?.extension?.loadingHeight || '212px';
  })

  const chartHeight = computed(() => {
    return localData.value?.extension?.chartHeight || '212px';
  })

  // 是否触发自定义事件
  const emitCustomEvent = computed(() => {
    if (!isDataValid()) return false
    return customEventComponents.includes(componentInfo.value.name) || componentInfo.value?.extension?.emitEvent;
  })


  const closeInsight = function () {
    renderChart()
  }

  const isLowCode = computed(() => componentInfo.value?.type === 'lowcode')

  return {
    renderChart,
    changeChart,
    isDataValid,
    isSupportChange,
    destoryChart,
    fitHeight,
    emitCustomEvent,
    fullWidth,
    changeViewIndex,
    closeInsight,
    loadingHeight,
    chartHeight,
    isLowCode
  }
}