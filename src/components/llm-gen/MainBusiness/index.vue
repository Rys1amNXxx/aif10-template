<template>
  <div class="w-full flex items-center justify-between">
    <!-- 按钮组 -->
    <div class="radio-container" :class="{ 'opacity-60 pointer-events-none': tabsLoading }">
      <div class="flex gap-2">
        <div v-for="tab in tabs" :key="tab.id" class="flex items-center justify-center h-[26px] min-w-[68px] px-2 
        text-xs rounded cursor-pointer transition-all leading-none whitespace-nowrap border shadow-sm
             bg-white border-border-03 text-text-02-01 hover:bg-background-03 hover:black:bg-background-03-dark
             black:bg-[#1D273F] black:border-border-03-dark black:text-text-11-dark black:shadow-none" :class="[
              activeTabId === tab.id
                ? 'bg-[#E7EAFA] !text-text-05 !border-border-04 font-normal black:!bg-[#2C375D] black:!text-text-05-dark black:!border-border-04-dark'
                : ''
            ]" @click="activeTabId = tab.id">
          {{ tab.label }}
        </div>
      </div>
    </div>
    <!-- 下拉菜单 -->
    <el-dropdown @command="handleReportChange" trigger="click">
      <button type="button"
        class="flex items-center justify-center gap-1.5 w-[90px] h-[26px] rounded border text-xs font-normal transition-all duration-200
                 bg-white/80 border-border-03 text-text-02-01 hover:border-text-03-dark
                 black:bg-background-18-dark black:border-border-03-dark hover:black:border-text-04-dark black:text-text-02-01-dark black:shadow-[0_1px_2px_0_rgba(255,255,255,0.05)]">
        <span>{{ selectedReport }}</span>
        <DropdownArrow class="text-text-02-01 black:text-text-02-01-dark rotate-180" />
      </button>
      <template #dropdown>
        <el-dropdown-menu
          class="text-text-02-01 bg-white black:text-text-02-01-dark black:bg-background-18-dark black:border-border-03-dark">
          <el-dropdown-item v-for="report in reportOptions" :key="report" :command="report"
            class="!text-xs hover:!bg-background-03 hover:!text-text-02-01 black:hover:!bg-background-03-dark black:hover:!text-text-02-01-dark"
            :class="[
              selectedReport === report
                ? '!bg-[#FFFFFF] !text-[#636FFF] font-normal black:!bg-background-18-dark black:!text-text-05-dark'
                : ''
            ]">
            {{ report }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
    <div v-for="panel in chartPanels" :key="panel.key" class="rounded-xl">
      <div class="relative h-[220px]">
        <div v-if="chartLoading"
          class="absolute inset-0 flex items-center justify-center text-xs text-text-04 black:text-text-04-dark">
          图表加载中…
        </div>
        <div v-else-if="!chartConfigs[panel.key]"
          class="absolute inset-0 flex items-center justify-center text-xs text-text-04 black:text-text-04-dark">
          暂无数据
        </div>
        <div class="h-full" :ref="el => setChartRef(panel.key, el as HTMLElement)"></div>
      </div>
    </div>
  </div>

  <!-- 纯展示表格 -->
  <div v-if="tableRows.length" class="overflow-x-auto">
    <table class="w-full text-xs border-collapse">
      <!-- 表头 -->
      <thead>
        <tr class="bg-[#F2F5FA] text-text-03 black:bg-background-03-dark black:text-text-03-dark">
          <th colspan="2" class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center">
            业务名称
          </th>
          <th
            class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px]">
            营业收入（元）
          </th>
          <th class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px]">
            收入比例
          </th>
          <th
            class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px]">
            营业成本（元）
          </th>
          <th class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px]">
            成本比例
          </th>
          <th
            class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px]">
            主营利润（元）
          </th>
          <th class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px]">
            利润比例
          </th>
          <th class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[80px]">
            毛利率
          </th>
        </tr>
      </thead>
      <!-- 表格内容 -->
      <tbody>
        <template v-for="(row, rowIndex) in tableRows" :key="rowIndex">
          <tr class="bg-background-00 black:bg-background-00-dark hover:bg-[#F8FAFC] black:hover:bg-background-03-dark">
            <!-- 分类列 - 动态 rowspan -->
            <td v-if="shouldShowCategoryCell(rowIndex)" :rowspan="getCategoryRowspan(rowIndex)" class="w-[70px] px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-center font-medium
                     bg-background-03 text-text-03 black:bg-background-03-dark black:text-text-03-dark align-middle">
              {{ row.category }}
            </td>
            <!-- 业务名称 -->
            <td class="min-w-[140px] px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-center
                       bg-background-03 text-text-03 black:bg-background-03-dark black:text-text-03-dark">
              {{ row.businessName }}
            </td>
            <!-- 数据列 -->
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark black:bg-background-01-dark text-right text-text-02-01 black:text-text-02-02-dark">
              {{ formatAmount(row.revenue) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatPercent(row.revenueRatio) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatAmount(row.cost) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatPercent(row.costRatio) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatAmount(row.profit) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatPercent(row.profitRatio) }}
            </td>
            <td
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark">
              {{ formatPercent(row.grossMargin) }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>

  <div v-else
    class="flex h-32 items-center justify-center rounded-lg border border-dashed border-border-03 text-sm text-text-04 black:border-border-03-dark black:text-text-04-dark">
    暂无明细数据
  </div>


</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';
import DropdownArrow from '@/components/icons/DropdownArrow.vue';
import componentConfig from './config.json';

type ChartCategory = 'industry' | 'product' | 'region';


interface ApiConfig {
  method: string;
  alias: string;
  url: string;
  params?: Record<string, any>;
  depends?: string[];
  [key: string]: any;
}

interface MainBusinessProps {
  params: {
    apis: ApiConfig[];
    view?: any;
    token?: any;
    hook?: any;
    [key: string]: any;
  };
  data?: any;
}

interface TabItem {
  id: string;
  label: string;
}

interface PieValue {
  name: string;
  value: number;
}

interface ChartRenderPayload {
  data: any[];
  view?: any;
  token?: any;
  hook?: any;
  [key: string]: any;
}

interface TableColumn {
  key: string;
  label: string;
  valueType?: 'text' | 'amount' | 'percent';
  align?: 'left' | 'right' | 'center';
}

type TableRow = Record<string, string | number | null | undefined>;

interface ChartAndTablePayload {
  charts?: Partial<Record<ChartCategory, any>>;
  table?: {
    columns?: TableColumn[];
    rows?: TableRow[];
    unit?: string;
  };
  [key: string]: any;
}

const props = defineProps<MainBusinessProps>();

const CHART_KEYS: ChartCategory[] = ['industry', 'product', 'region'];
const chartPanels = componentConfig.mockData.chartPanels as { key: ChartCategory; title: string }[];

// 固定的tabs配置，不再从外部获取
const FIXED_TABS: TabItem[] = [
  { id: 'revenue', label: '营业收入' },
  { id: 'cost', label: '营业成本' },
  { id: 'profit', label: '利润总额' }
];
const tabs = ref<TabItem[]>(FIXED_TABS);
const tabsLoading = ref(false);
const activeTabId = ref('revenue');
const chartLoading = ref(false);
const chartConfigs = reactive<Record<ChartCategory, ChartRenderPayload | null>>({
  industry: null,
  product: null,
  region: null
});
const chartRefs: Record<ChartCategory, Ref<HTMLElement | null>> = {
  industry: ref<HTMLElement | null>(null),
  product: ref<HTMLElement | null>(null),
  region: ref<HTMLElement | null>(null)
};
const tableColumns = ref<TableColumn[]>([]);
const tableRows = ref<TableRow[]>([]);
const tableUnit = ref('亿');
const isFirstChartFromProps = ref(true);
const selectedReport = ref(componentConfig.mockData.reportOptions[0]);
const reportOptions = componentConfig.mockData.reportOptions;
const isDark = ref(false);

const activeTabLabel = computed(() => tabs.value.find(item => item.id === activeTabId.value)?.label ?? '');

const baseTableColumns: TableColumn[] = componentConfig.mockData.tableColumns as TableColumn[];

// 业务名称归类规则
const businessCategoryMap: Record<string, string> = componentConfig.mockData.businessCategoryMap;

// 业务归类函数
const getBusinessCategory = (businessName: string): string => {
  // 优先使用映射表
  if (businessCategoryMap[businessName]) {
    return businessCategoryMap[businessName];
  }

  // 根据关键词判断
  if (businessName.includes('（产品）') || businessName.includes('业务')) {
    return '按产品';
  }
  if (businessName.includes('地区') || businessName.includes('国') || /^[A-Z]{2,}$/.test(businessName)) {
    return '按地区';
  }
  return '按行业';
};

const baseBusinessRows = componentConfig.mockData.tableRows;

const pieTemplates = componentConfig.mockData.pieTemplates;

const getApiByAlias = (alias: string) => props.params?.apis?.find(api => api.alias === alias);

const initTabs = () => {
  tabs.value = FIXED_TABS;
  if (!activeTabId.value) {
    activeTabId.value = FIXED_TABS[0].id;
  }
};

const pickExternalChartPayload = (tabId: string): ChartAndTablePayload | undefined => {
  if (!props.data) return undefined;
  const pools = [
    props.data?.charts,
    props.data?.chartMap,
    props.data?.chart_group,
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

// 初始化时获取表格数据（只在首次加载时调用）
const fetchTableData = async () => {
  // 优先从 props 获取数据
  if (isFirstChartFromProps.value) {
    const externalPayload = pickExternalChartPayload('revenue');
    if (externalPayload) {
      applyTableData(externalPayload);
      isFirstChartFromProps.value = false;
      updatePieChartsForTab(activeTabId.value);
      return;
    }
  }

  const api = getApiByAlias('composition');
  if (!api) {
    applyTableData(mockChartDataset.revenue);
    isFirstChartFromProps.value = false;
    updatePieChartsForTab(activeTabId.value);
    return;
  }

  chartLoading.value = true;
  try {
    const url = processUrl(api.url);
    const method = api.method?.toLowerCase?.() ?? 'get';
    const apiData = { tabs: tabs.value, activeTabId: 'revenue' };
    const params = processParams(api.params || {}, apiData);

    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });

    const payload = response.data?.data ?? response.data;
    applyTableData(payload);
  } catch (error) {
    console.error('获取主营构成数据失败:', error);
    applyTableData(mockChartDataset.revenue);
  } finally {
    chartLoading.value = false;
    isFirstChartFromProps.value = false;
    // 表格数据加载完成后，根据当前 tab 更新饼图
    updatePieChartsForTab(activeTabId.value);
  }
};

// 初始化表格数据（只在首次加载时调用）
const applyTableData = (payload: ChartAndTablePayload | undefined) => {
  const fallback = mockChartDataset.revenue;
  const safePayload = payload ?? fallback;

  // 1. 设置表格数据
  const incomingRows = safePayload.table?.rows?.length
    ? safePayload.table.rows
    : fallback.table?.rows ?? [];
  tableRows.value = [...incomingRows];

  const incomingColumns = safePayload.table?.columns?.length
    ? safePayload.table.columns
    : fallback.table?.columns ?? baseTableColumns;
  tableColumns.value = [...incomingColumns];

  tableUnit.value = safePayload.table?.unit ?? fallback.table?.unit ?? tableUnit.value ?? '亿';
};

// 根据当前选中的 tab 更新饼图（不影响表格数据）
const updatePieChartsForTab = (tabId: string) => {
  CHART_KEYS.forEach(key => {
    // 根据表格数据和当前 tab 动态生成饼图数据
    const aggregatedData = aggregatePieDataFromTable(tableRows.value, key, tabId);

    if (aggregatedData && aggregatedData.length > 0) {
      // 使用聚合后的数据构建图表配置
      chartConfigs[key] = createPieChartConfig(
        chartPanels.find(p => p.key === key)?.title ?? '',
        aggregatedData
      );
    } else {
      // 降级逻辑：使用 mock 数据
      const fallback = mockChartDataset[tabId] ?? mockChartDataset.revenue;
      const rawConfig = fallback.charts?.[key];
      chartConfigs[key] = normalizeChartConfig(rawConfig);
    }
  });

  renderCharts();
};

// 兼容旧的调用方式（首次加载时同时设置表格和饼图）
const applyChartPayload = (payload: ChartAndTablePayload | undefined, tabKey: string) => {
  applyTableData(payload);
  updatePieChartsForTab(tabKey);
};

// 从表格数据聚合饼图数据的函数
const aggregatePieDataFromTable = (rows: TableRow[], categoryKey: ChartCategory, tabId: string): PieValue[] => {
  // 映射表：将表格的 category 字段映射到对应的图表 key
  // industry: '按行业', product: '按产品', region: '按地区'
  const categoryLabelMap: Record<ChartCategory, string> = {
    industry: '按行业',
    product: '按产品',
    region: '按地区'
  };

  const targetCategory = categoryLabelMap[categoryKey];
  if (!targetCategory) return [];

  // 1. 筛选属于当前分类（如"按行业"）的行
  const filteredRows = rows.filter(row => row.category === targetCategory);
  if (!filteredRows.length) return [];

  // 2. 根据当前选中的 tab 确定使用哪个比例字段
  const ratioKeyMap: Record<string, string> = {
    revenue: 'revenueRatio',
    cost: 'costRatio',
    profit: 'profitRatio'
  };
  const ratioKey = ratioKeyMap[tabId] || 'revenueRatio';

  return filteredRows.map(row => ({
    name: String(row.businessName || ''),
    value: Number(row[ratioKey] || 0)
  })).filter(item => item.value > 0);
};

const normalizeChartConfig = (config: any): ChartRenderPayload | null => {
  if (!config) return null;
  if (config.renderConfig) {
    return {
      ...config.renderConfig,
      data: config.renderConfig.data ?? config.data ?? []
    };
  }
  return {
    ...config,
    data: config.data ?? []
  };
};

const renderCharts = () => {
  nextTick(() => {
    CHART_KEYS.forEach(key => renderChartByKey(key));
  });
};

const renderChartByKey = (key: ChartCategory) => {
  const dom = chartRefs[key].value;
  const config = chartConfigs[key];
  if (!dom || !config) return;
  if (!window?.AIGCDataVis?.render) return;

  const renderParams = {
    ...props.params,
    ...config,
    data: config.data ?? [],
    view: config.view ?? props.params.view,
    token: config.token ?? props.params.token,
    hook: config.hook ?? props.params.hook
  };

  try {
    window.AIGCDataVis.render(dom, renderParams);
  } catch (error) {
    console.error(`渲染${key}图表失败:`, error);
  }
};

const setChartRef = (key: ChartCategory, el: HTMLElement | null) => {
  chartRefs[key].value = el;
};

const formatAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') return value;
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return tableUnit.value ? `${formatted}${tableUnit.value}` : formatted;
};

const formatPercent = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') {
    return value.includes('%') ? value : `${value}%`;
  }
  return `${value.toFixed(2)}%`;
};

const cellAlignClass = (align: TableColumn['align']) => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const handleReportChange = (report: string) => {
  selectedReport.value = report;
};

// 判断是否显示分类单元格（只在该分类的第一行显示）
const shouldShowCategoryCell = (rowIndex: number): boolean => {
  if (rowIndex === 0) return true;
  return tableRows.value[rowIndex].category !== tableRows.value[rowIndex - 1].category;
};

// 计算分类的 rowspan（动态计算该分类有多少行）
const getCategoryRowspan = (rowIndex: number): number => {
  const currentCategory = tableRows.value[rowIndex].category;
  let count = 1;
  let nextIndex = rowIndex + 1;
  while (nextIndex < tableRows.value.length && tableRows.value[nextIndex].category === currentCategory) {
    count++;
    nextIndex++;
  }
  return count;
};

function createMockPayload(centerTitle: string, total: number, scale: number): ChartAndTablePayload {
  const pieValues = getMockPieValues(scale);
  return {
    charts: {
      industry: createPieChartConfig('按行业分', pieValues.industry, `${total.toFixed(2)}亿`),
      product: createPieChartConfig('按产品分', pieValues.product, `${total.toFixed(2)}亿`),
      region: createPieChartConfig('按地区分', pieValues.region, `${total.toFixed(2)}亿`)
    },
    table: {
      columns: baseTableColumns,
      rows: createTableRows(scale),
      unit: '亿'
    }
  };
}

function createTableRows(scale: number): TableRow[] {
  return baseBusinessRows.map(row => ({
    ...row,
    revenue: +(row.revenue * scale).toFixed(2),
    cost: +(row.cost * scale).toFixed(2),
    profit: +(row.profit * scale).toFixed(2),
    category: row.category || getBusinessCategory(String(row.businessName || ''))
  }));
}

function getMockPieValues(scale: number) {
  return {
    industry: scalePieValues(pieTemplates.industry, scale),
    product: scalePieValues(pieTemplates.product, scale),
    region: scalePieValues(pieTemplates.region, scale)
  };
}

function scalePieValues(values: PieValue[], scale: number) {
  return values.map(item => ({
    ...item,
    value: +(item.value * scale).toFixed(2)
  }));
}

// 修改：createPieChartConfig 改为支持动态数据，使用配置文件中的图表配置
function createPieChartConfig(centerTitle: string, values: PieValue[], centerValue?: string): ChartRenderPayload {
  const { pie, themeColors } = componentConfig.chartConfig;
  const colors = isDark.value ? themeColors.dark : themeColors.light;

  return {
    data: [{ values }],
    view: {
      main: {
        title: [
          {
            text: `{mainTitle|${centerTitle}}`,
            left: pie.view.main.title[0].left,
            top: pie.view.main.title[0].top,
            textStyle: {
              fontSize: pie.view.main.title[0].textStyle.fontSize,
              color: colors.subtitleColor,
              lineHeight: pie.view.main.title[0].textStyle.lineHeight,
              rich: {
                mainTitle: {
                  fontSize: pie.view.main.title[0].textStyle.rich.mainTitle.fontSize,
                  color: colors.titleColor,
                  lineHeight: pie.view.main.title[0].textStyle.rich.mainTitle.lineHeight,
                  fontWeight: pie.view.main.title[0].textStyle.rich.mainTitle.fontWeight
                }
              }
            }
          }
        ],
        layers: pie.view.main.layers
      }
    },
    token: {
      dvStandardChart: {
        baseOption: {
          legend: {
            textStyle: { color: colors.legendColor },
            backgroundColor: pie.token.dvStandardChart.baseOption.legend.backgroundColor,
            dvPagination: { color: colors.legendColor }
          },
          tooltip: pie.token.dvStandardChart.baseOption.tooltip
        }
      }
    }
  };
}

// 根据配置生成 mockChartDataset
const mockChartDataset: Record<string, ChartAndTablePayload> = Object.fromEntries(
  Object.entries(componentConfig.mockData.mockDatasetScales).map(([key, config]) => [
    key,
    createMockPayload(config.centerTitle, config.total, config.scale)
  ])
);

const resetState = () => {
  tabs.value = FIXED_TABS;
  activeTabId.value = 'revenue';
  CHART_KEYS.forEach(key => {
    chartConfigs[key] = null;
  });
  tableColumns.value = [...baseTableColumns];
  tableRows.value = [];
  tableUnit.value = '亿';
  isFirstChartFromProps.value = true;
};

const bootstrap = async () => {
  initTabs();
  await fetchTableData();
};

let observer: number | null = null;

onMounted(() => {
  bootstrap();
  // 初始化暗黑模式状态
  isDark.value = localStorage.getItem('vueuse-color-scheme') === 'dark';

  // 监听 localStorage 变化 (用于跨标签页或 storage 事件)
  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme') {
      isDark.value = e.newValue === 'dark';
    }
  });

  // 轮询检查 localStorage (兼容同一页面内非 storage 事件触发的变更)
  observer = window.setInterval(() => {
    const currentTheme = localStorage.getItem('vueuse-color-scheme');
    if ((currentTheme === 'dark') !== isDark.value) {
      isDark.value = currentTheme === 'dark';
    }
  }, 100);
});

onUnmounted(() => {
  if (observer) {
    clearInterval(observer);
    observer = null;
  }
});

watch(isDark, () => {
  // 暗黑模式切换时重新生成图表配置并渲染
  if (activeTabId.value) {
    // 只需更新饼图配置，表格数据不变
    updatePieChartsForTab(activeTabId.value);
  }
});

watch(activeTabId, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    // tab 切换只更新饼图，不重新获取表格数据
    updatePieChartsForTab(newVal);
  }
});

watch(
  () => props.data,
  () => {
    resetState();
    bootstrap();
  },
  { deep: true }
);

watch(
  () => [props.params.token, props.params.view],
  () => {
    renderCharts();
  },
  { deep: true }
);
</script>

<style scoped>
/* 按钮组容器 */
.radio-container {
  overflow-x: auto;
  border-radius: 0.5rem;
  background-color: var(--background-03);
  padding: 0.25rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.radio-container::-webkit-scrollbar {
  display: none;
}
</style>
