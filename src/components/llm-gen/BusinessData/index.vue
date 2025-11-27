<template>
  <div class="w-full flex flex-col gap-4">
    <!-- 单选框组 (UI组件) -->
    <div class="radio-group-container">
      <el-radio-group v-model="activeTabId" size="small" :disabled="tabsLoading" class="custom-radio-group">
        <el-radio-button v-for="tab in tabs" :key="tab.id" :value="tab.id" class="custom-radio-button">
          {{ tab.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 柱形折线图 (可视化组件) -->
    <div class="chart-container">
      <div v-if="chartLoading" class="loading-placeholder">
        图表加载中…
      </div>
      <div v-else-if="!chartData" class="empty-placeholder">
        暂无图表数据
      </div>
      <div ref="chartRef" class="w-full h-[300px]"></div>
    </div>

    <!-- 树形表格 (可视化组件) -->
    <div class="table-container">
      <div v-if="tableLoading" class="loading-placeholder">
        表格加载中…
      </div>
      <div v-else-if="!tableData || tableData.length === 0" class="empty-placeholder">
        暂无表格数据
      </div>
      <div ref="tableRef" class="w-full min-h-[200px]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { ElRadioGroup, ElRadioButton } from 'element-plus';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';
import componentConfig from './config.json';

// ==================== 类型定义 ====================

interface ApiConfig {
  method: string;
  alias: string;
  url: string;
  params?: Record<string, any>;
  depends?: string[];
  isFirstScreen?: boolean;
  [key: string]: any;
}

interface TabItem {
  id: string;
  label: string;
}

interface BusinessDataProps {
  params: {
    apis: ApiConfig[];
    view?: any;
    token?: any;
    hook?: any;
    [key: string]: any;
  };
  data?: any;
}

// ==================== Props 定义 ====================

const props = defineProps<BusinessDataProps>();

// ==================== 响应式数据 ====================

// Tab 相关
const tabs = ref<TabItem[]>([]);
const tabsLoading = ref(false);
const activeTabId = ref('');

// 图表相关
const chartRef = ref<HTMLElement | null>(null);
const chartData = ref<any>(null);
const chartLoading = ref(false);

// 表格相关
const tableRef = ref<HTMLElement | null>(null);
const tableData = ref<any[]>([]);
const tableLoading = ref(false);

// 首屏数据标记
const isFirstChartFromProps = ref(true);

// 主题相关
const isDark = ref(false);

// ==================== Mock 数据 ====================

const mockTabs: TabItem[] = componentConfig.mockData.tabs;
const mockChartData = componentConfig.mockData.chartData;
const mockTableData = componentConfig.mockData.tableData;

// ==================== 工具函数 ====================

const getApiByAlias = (alias: string): ApiConfig | undefined => {
  return props.params?.apis?.find(api => api.alias === alias);
};

const normalizeTabs = (raw: any): TabItem[] => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.tabs ?? raw.data ?? [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item: any, index: number) => ({
      id: String(item.id ?? item.value ?? item.key ?? index),
      label: item.label ?? item.name ?? item.title ?? `选项${index + 1}`
    }))
    .filter(item => item.id && item.label);
};

const setTabs = (list: TabItem[]) => {
  tabs.value = list;
  if (!list.length) {
    activeTabId.value = '';
    return;
  }
  if (!list.some(item => item.id === activeTabId.value)) {
    activeTabId.value = list[0].id;
  }
};

// ==================== 数据获取 ====================

/**
 * 获取 Tabs 数据
 * 优先使用外部传入的 data，其次请求 API，最后使用 mock 数据
 */
const fetchTabs = async () => {
  tabsLoading.value = true;

  try {
    // 1. 优先使用外部传入的 tabs 数据
    if (Array.isArray(props.data?.tabs) && props.data.tabs.length) {
      const normalized = normalizeTabs(props.data.tabs);
      setTabs(normalized.length ? normalized : mockTabs);
      return;
    }

    // 2. 尝试通过 API 请求
    const api = getApiByAlias('tabs');
    if (!api) {
      setTabs(mockTabs);
      return;
    }

    const url = processUrl(api.url);
    const method = api.method?.toLowerCase?.() ?? 'get';
    const params = processParams(api.params || {});

    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });

    const normalized = normalizeTabs(response.data?.data ?? response.data);
    setTabs(normalized.length ? normalized : mockTabs);
  } catch (error) {
    console.error('获取 tabs 失败:', error);
    setTabs(mockTabs);
  } finally {
    tabsLoading.value = false;
  }
};

/**
 * 从外部 props.data 中提取对应 tab 的图表和表格数据
 */
const pickExternalPayload = (tabId: string): Record<string, any> | undefined => {
  if (!props.data) return undefined;

  const pools = [
    props.data?.chartData,
    props.data?.charts,
    props.data?.data,
    props.data
  ];

  for (const pool of pools) {
    if (!pool) continue;
    if (pool[tabId]) return pool[tabId];
    if (Array.isArray(pool)) {
      const matched = pool.find(
        (item: any) => item?.id === tabId || item?.alias === tabId || item?.key === tabId
      );
      if (matched) return matched;
    }
  }

  return undefined;
};

/**
 * 获取图表和表格数据
 * Tabs 只请求一次，图表数据根据 Tab 切换而变化
 */
const fetchChartAndTable = async (tabId: string) => {
  if (!tabId) return;

  // 1. 首屏渲染时，优先使用外部传入的数据
  if (isFirstChartFromProps.value) {
    const externalPayload = pickExternalPayload(tabId);
    if (externalPayload) {
      applyPayload(externalPayload);
      isFirstChartFromProps.value = false;
      return;
    }
  }

  // 2. 尝试通过 API 请求
  const api = getApiByAlias('chartData');
  if (!api) {
    // 使用 mock 数据
    applyPayload({ chart: mockChartData, table: mockTableData });
    isFirstChartFromProps.value = false;
    return;
  }

  chartLoading.value = true;
  tableLoading.value = true;

  try {
    const url = processUrl(api.url);
    const method = api.method?.toLowerCase?.() ?? 'get';
    const apiData = { tabs: tabs.value, activeTabId: tabId };
    const params = processParams(api.params || {}, apiData);

    // 动态注入 tab_id
    if (typeof params === 'object' && params !== null) {
      if ('tab_id' in params) params.tab_id = tabId;
      if (typeof params.extensions === 'object' && params.extensions !== null) {
        if ('tab_id' in params.extensions) params.extensions.tab_id = tabId;
      }
    }

    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });

    const payload = response.data?.data ?? response.data;
    applyPayload(payload);
  } catch (error) {
    console.error('获取图表数据失败:', error);
    applyPayload({ chart: mockChartData, table: mockTableData });
  } finally {
    chartLoading.value = false;
    tableLoading.value = false;
    isFirstChartFromProps.value = false;
  }
};

/**
 * 应用获取到的数据
 */
const applyPayload = (payload: Record<string, any> | undefined) => {
  const safePayload = payload ?? { chart: mockChartData, table: mockTableData };

  // 处理图表数据（兼容多种字段名）
  chartData.value = safePayload.chart ?? safePayload.chartData ?? safePayload.barLineData ?? mockChartData;

  // 处理表格数据（兼容多种字段名）
  const tableSource = safePayload.table ?? safePayload.tableData ?? safePayload.treeTableData ?? mockTableData;
  tableData.value = Array.isArray(tableSource)
    ? tableSource
    : tableSource?.data ?? mockTableData;

  // 渲染可视化组件
  renderVisualizations();
};

// ==================== 可视化渲染 ====================

/**
 * 渲染所有可视化组件
 */
const renderVisualizations = () => {
  nextTick(() => {
    renderChart();
    renderTable();
  });
};

/**
 * 渲染柱形折线图
 */
const renderChart = () => {
  const dom = chartRef.value;
  if (!dom || !chartData.value) return;
  if (!window?.AIGCDataVis?.render) {
    console.warn('AIGCDataVis 未加载');
    return;
  }

  const chartConfig = componentConfig.chartConfig.barLine;

  const renderParams = {
    ...props.params,
    data: chartData.value.data ?? [{ values: chartData.value }],
    view: chartConfig.view ?? props.params.view,
    token: props.params.token,
    hook: props.params.hook
  };

  try {
    window.AIGCDataVis.render(dom, renderParams);
  } catch (error) {
    console.error('渲染图表失败:', error);
  }
};

/**
 * 渲染树形表格
 */
const renderTable = () => {
  const dom = tableRef.value;
  if (!dom || !tableData.value?.length) return;
  if (!window?.AIGCDataVis?.render) {
    console.warn('AIGCDataVis 未加载');
    return;
  }

  const tableConfig = componentConfig.chartConfig.treeTable;

  const renderParams = {
    ...props.params,
    data: [{ values: tableData.value }],
    view: tableConfig.view ?? props.params.view,
    token: props.params.token,
    hook: props.params.hook
  };

  try {
    window.AIGCDataVis.render(dom, renderParams);
  } catch (error) {
    console.error('渲染表格失败:', error);
  }
};

// ==================== 状态重置 ====================

const resetState = () => {
  tabs.value = [];
  activeTabId.value = '';
  chartData.value = null;
  tableData.value = [];
  isFirstChartFromProps.value = true;
};

// ==================== 初始化 ====================

const bootstrap = async () => {
  await fetchTabs();
};

// ==================== 生命周期 ====================

let themeObserver: number | null = null;

onMounted(() => {
  bootstrap();

  // 初始化暗黑模式状态
  isDark.value = localStorage.getItem('vueuse-color-scheme') === 'dark';

  // 监听 localStorage 变化（跨标签页）
  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme') {
      isDark.value = e.newValue === 'dark';
    }
  });

  // 轮询检查主题变化（同页面内）
  themeObserver = window.setInterval(() => {
    const currentTheme = localStorage.getItem('vueuse-color-scheme');
    if ((currentTheme === 'dark') !== isDark.value) {
      isDark.value = currentTheme === 'dark';
    }
  }, 100);
});

onUnmounted(() => {
  if (themeObserver) {
    clearInterval(themeObserver);
    themeObserver = null;
  }
});

// ==================== 监听器 ====================

// 监听 Tab 切换，重新获取图表数据
watch(activeTabId, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    fetchChartAndTable(newVal);
  }
});

// 监听外部 data 变化，重置并重新初始化
watch(
  () => props.data,
  () => {
    resetState();
    bootstrap();
  },
  { deep: true }
);

// 监听主题/视图配置变化，重新渲染
watch(
  () => [props.params.token, props.params.view],
  () => {
    renderVisualizations();
  },
  { deep: true }
);

// 监听暗黑模式变化，重新渲染
watch(isDark, () => {
  renderVisualizations();
});
</script>

<style scoped>
/* 单选框组容器 */
.radio-group-container {
  padding: 4px;
  background-color: var(--background-03, #F2F5FA);
  border-radius: 8px;
  display: inline-flex;
}

:global(.dark) .radio-group-container {
  background-color: #1D273F;
}

/* 自定义 Radio Group 样式 */
.custom-radio-group {
  --el-radio-button-checked-bg-color: #636FFF;
  --el-radio-button-checked-text-color: #fff;
  --el-radio-button-checked-border-color: #636FFF;
}

:deep(.el-radio-button__inner) {
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--text-02-01, #545E71);
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 6px !important;
  transition: all 0.2s ease;
}

:deep(.el-radio-button__inner:hover) {
  background-color: var(--background-03, #E8EBF0);
  color: var(--text-02-01, #545E71);
}

:deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: #636FFF;
  color: #fff;
  border-color: #636FFF;
  box-shadow: none;
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: #636FFF;
  color: #fff;
  border-color: #636FFF;
  box-shadow: none;
}

:global(.dark) :deep(.el-radio-button__inner) {
  color: #A9B2BE;
}

:global(.dark) :deep(.el-radio-button__inner:hover) {
  background-color: #2C375D;
}

:global(.dark) :deep(.el-radio-button.is-active .el-radio-button__inner),
:global(.dark) :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: #7B8AFF;
  border-color: #7B8AFF;
}

/* 图表容器 */
.chart-container {
  position: relative;
  background-color: transparent;
  border-radius: 12px;
}

:global(.dark) .chart-container {
  background-color: var(--background-01-dark, #141C30);
  border-color: var(--border-03-dark, #2C375D);
}

/* 表格容器 */
.table-container {
  position: relative;
  background-color: var(--background-00, #fff);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border-03, #EBEEF6);
  overflow-x: auto;
}

:global(.dark) .table-container {
  background-color: var(--background-01-dark, #141C30);
  border-color: var(--border-03-dark, #2C375D);
}

/* 加载和空状态占位 */
.loading-placeholder,
.empty-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-04, #9CA3AF);
  z-index: 10;
  background-color: inherit;
  border-radius: inherit;
}

:global(.dark) .loading-placeholder,
:global(.dark) .empty-placeholder {
  color: var(--text-04-dark, #6B7280);
}
</style>
