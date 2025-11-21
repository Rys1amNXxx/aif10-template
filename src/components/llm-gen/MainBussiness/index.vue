<template>
  <div class="w-full flex flex-col gap-4">
    <!-- 下拉菜单和按钮组在同一行 -->
    <div class="flex items-center gap-3">
      <div class="radio-container flex-1" v-loading="tabsLoading">
        <el-radio-group v-model="activeTabId" class="radio-button-group" :disabled="tabsLoading">
          <el-radio-button v-for="tab in tabs" :key="tab.id" :label="tab.id">
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <el-dropdown @command="handleReportChange" trigger="click">
        <button type="button" class="report-select">
          <span>{{ selectedReport }}</span>
          <DropdownArrow class="text-slate-500 rotate-180" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="report in reportOptions" :key="report" :command="report"
              :class="{ 'is-active': selectedReport === report }">
              {{ report }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div v-for="panel in chartPanels" :key="panel.key" class="rounded-xl">
        <div class="relative mt-4 h-[220px]">
          <div v-if="chartLoading" class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            图表加载中…
          </div>
          <div v-else-if="!chartConfigs[panel.key]"
            class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            暂无数据
          </div>
          <div class="h-full" :ref="el => setChartRef(panel.key, el as HTMLElement)"></div>
        </div>
      </div>
    </div>

    <div class="rounded-xl border-slate-200/80 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div v-if="tableRows.length" class="overflow-x-auto">
        <table
          class="min-w-full divide-y divide-slate-200 text-xs text-slate-600 dark:divide-slate-700 dark:text-slate-200">
          <thead class="bg-slate-50/80 dark:bg-slate-800/60">
            <tr>
              <th v-for="column in tableColumns" :key="column.key" :class="[
                'px-4 py-2 font-medium text-slate-500 uppercase tracking-wide dark:text-slate-400',
                column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
              ]">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="(row, rowIndex) in tableRows" :key="`${row.businessName}-${rowIndex}`"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
              <td v-for="column in tableColumns" :key="`${column.key}-${rowIndex}`"
                :class="['px-4 py-2', cellAlignClass(column.align)]">
                <span v-if="column.valueType === 'amount'">{{ formatAmount(row[column.key]) }}</span>
                <span v-else-if="column.valueType === 'percent'">{{ formatPercent(row[column.key]) }}</span>
                <span v-else>{{ row[column.key] ?? '-' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else
        class="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
        暂无明细数据
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick, type Ref } from 'vue';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';
import DropdownArrow from '@/components/icons/DropdownArrow.vue';

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
const chartPanels = [
  { key: 'industry' as ChartCategory, title: '按行业分' },
  { key: 'product' as ChartCategory, title: '按产品分' },
  { key: 'region' as ChartCategory, title: '按地区分' }
];

const tabs = ref<TabItem[]>([]);
const tabsLoading = ref(false);
const activeTabId = ref('');
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
const selectedReport = ref('2023年报');
const reportOptions = ['2023年报', '2022年报', '2021年报'];

const activeTabLabel = computed(() => tabs.value.find(item => item.id === activeTabId.value)?.label ?? '');

const baseTableColumns: TableColumn[] = [
  { key: 'businessName', label: '业务名称', valueType: 'text', align: 'left' },
  { key: 'revenue', label: '营业收入（元）', valueType: 'amount', align: 'right' },
  { key: 'revenueRatio', label: '收入比例', valueType: 'percent', align: 'right' },
  { key: 'cost', label: '营业成本（元）', valueType: 'amount', align: 'right' },
  { key: 'costRatio', label: '成本比例', valueType: 'percent', align: 'right' },
  { key: 'profit', label: '主营利润（元）', valueType: 'amount', align: 'right' },
  { key: 'profitRatio', label: '利润比例', valueType: 'percent', align: 'right' },
  { key: 'grossMargin', label: '毛利率', valueType: 'percent', align: 'right' }
];

const mockTabs: TabItem[] = [
  { id: 'revenue', label: '营业收入' },
  { id: 'cost', label: '营业成本' },
  { id: 'profit', label: '利润总额' }
];

const baseBusinessRows = [
  { businessName: '服务贸易及其他', revenue: 3554.64, revenueRatio: 97.12, cost: 2555.55, costRatio: 99.56, profit: 736.58, profitRatio: 82.36, grossMargin: 10.17 },
  { businessName: '金融业务', revenue: 185.23, revenueRatio: 2.48, cost: 26.36, costRatio: 0.41, profit: 158.17, profitRatio: 17.61, grossMargin: 85.45 },
  { businessName: '整车业务', revenue: 5023.36, revenueRatio: 67.56, cost: 4753.14, costRatio: 72.25, profit: 238.35, profitRatio: 32.52, grossMargin: 5.79 },
  { businessName: '零部件业务', revenue: 1828.25, revenueRatio: 25.23, cost: 1525.22, costRatio: 22.36, profit: 355.96, profitRatio: 39.64, grossMargin: 19.46 },
  { businessName: '服务贸易（产品）', revenue: 373.56, revenueRatio: 5.1, cost: 232.43, costRatio: 2.43, profit: 123.35, profitRatio: 9.49, grossMargin: 19.28 },
  { businessName: '金融业务（产品）', revenue: 185.06, revenueRatio: 2.55, cost: 26.36, costRatio: 0.41, profit: 158.58, profitRatio: 17.62, grossMargin: 85.36 },
  { businessName: '中国', revenue: 373.56, revenueRatio: 5.1, cost: 288.88, costRatio: 4.4, profit: 91.36, profitRatio: 10.17, grossMargin: 23.07 },
  { businessName: '其他地区', revenue: 253.32, revenueRatio: 4.76, cost: 195.73, costRatio: 2.77, profit: 43.58, profitRatio: 5.73, grossMargin: 31.54 }
];

const pieTemplates = {
  industry: [
    { name: '汽车制造业', value: 59.9 },
    { name: '整车零部件', value: 25.4 },
    { name: '服务贸易', value: 9.2 },
    { name: '金融业务', value: 5.5 }
  ],
  product: [
    { name: '整车业务', value: 67.56 },
    { name: '零部件业务', value: 25.23 },
    { name: '服务贸易及其他', value: 5.1 },
    { name: '金融业务', value: 2.55 }
  ],
  region: [
    { name: '中国', value: 73.56 },
    { name: '其他亚洲', value: 15.88 },
    { name: '欧洲', value: 6.12 },
    { name: '北美', value: 4.44 }
  ]
};

const getApiByAlias = (alias: string) => props.params?.apis?.find(api => api.alias === alias);

const normalizeTabs = (raw: any): TabItem[] => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.tabs ?? raw.businessTabs ?? raw.business_name_list ?? raw.data ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item: any, index: number) => ({
      id: String(item.id ?? item.value ?? item.alias ?? item.key ?? index),
      label: item.label ?? item.name ?? item.title ?? item.text ?? `选项${index + 1}`
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

const fetchTabs = async () => {
  tabsLoading.value = true;
  try {
    if (Array.isArray(props.data?.tabs) && props.data?.tabs.length) {
      const normalized = normalizeTabs(props.data.tabs);
      setTabs(normalized.length ? normalized : mockTabs);
      return;
    }
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
    console.error('获取tabs失败:', error);
    setTabs(mockTabs);
  } finally {
    tabsLoading.value = false;
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

const fetchCharts = async (tabId: string) => {
  if (!tabId) return;

  if (isFirstChartFromProps.value) {
    const externalPayload = pickExternalChartPayload(tabId);
    if (externalPayload) {
      applyChartPayload(externalPayload, tabId);
      isFirstChartFromProps.value = false;
      return;
    }
  }

  const api = getApiByAlias('composition');
  if (!api) {
    applyChartPayload(mockChartDataset[tabId] ?? mockChartDataset.revenue, tabId);
    isFirstChartFromProps.value = false;
    return;
  }

  chartLoading.value = true;
  try {
    const url = processUrl(api.url);
    const method = api.method?.toLowerCase?.() ?? 'get';
    const apiData = { tabs: tabs.value, activeTabId: tabId };
    const params = processParams(api.params || {}, apiData);

    if (typeof params === 'object' && params !== null) {
      if ('tab_id' in params) params.tab_id = tabId;
      if ('tabKey' in params) params.tabKey = tabId;
      if ('metric' in params) params.metric = tabId;
      if (typeof params.extensions === 'object' && params.extensions !== null) {
        if ('tab_id' in params.extensions) params.extensions.tab_id = tabId;
        if ('tabKey' in params.extensions) params.extensions.tabKey = tabId;
        if ('metric' in params.extensions) params.extensions.metric = tabId;
      }
    }

    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });

    const payload = response.data?.data ?? response.data;
    applyChartPayload(payload, tabId);
  } catch (error) {
    console.error('获取主营构成图表失败:', error);
    applyChartPayload(mockChartDataset[tabId] ?? mockChartDataset.revenue, tabId);
  } finally {
    chartLoading.value = false;
    isFirstChartFromProps.value = false;
  }
};

const applyChartPayload = (payload: ChartAndTablePayload | undefined, tabKey: string) => {
  const fallback = mockChartDataset[tabKey] ?? mockChartDataset.revenue;
  const safePayload = payload ?? fallback;
  const chartSource = safePayload.charts ?? safePayload.chartGroup ?? {};

  CHART_KEYS.forEach(key => {
    const rawConfig =
      chartSource[key] ??
      chartSource[`${key}Chart`] ??
      chartSource[`${key}_chart`] ??
      fallback.charts?.[key];
    chartConfigs[key] = normalizeChartConfig(rawConfig);
  });

  const incomingColumns = safePayload.table?.columns?.length
    ? safePayload.table.columns
    : fallback.table?.columns ?? baseTableColumns;
  tableColumns.value = [...incomingColumns];

  const incomingRows = safePayload.table?.rows?.length
    ? safePayload.table.rows
    : fallback.table?.rows ?? [];
  tableRows.value = [...incomingRows];

  tableUnit.value = safePayload.table?.unit ?? fallback.table?.unit ?? tableUnit.value ?? '亿';

  renderCharts();
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
  const ratio = value > 1 ? value : value * 100;
  return `${ratio.toFixed(2)}%`;
};

const cellAlignClass = (align: TableColumn['align']) => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const handleReportChange = (report: string) => {
  selectedReport.value = report;
};

function createMockPayload(centerTitle: string, total: number, scale: number): ChartAndTablePayload {
  const pieValues = getMockPieValues(scale);
  return {
    charts: {
      industry: createPieChartConfig('按行业分', `${total.toFixed(2)}亿`, pieValues.industry),
      product: createPieChartConfig('按产品分', `${total.toFixed(2)}亿`, pieValues.product),
      region: createPieChartConfig('按地区分', `${total.toFixed(2)}亿`, pieValues.region)
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
    profit: +(row.profit * scale).toFixed(2)
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

function createPieChartConfig(centerTitle: string, centerValue: string, values: PieValue[]): ChartRenderPayload {
  return {
    data: [
      {
        values
      }
    ],
    view: {
      main: {
        title: [
          {
            text: `{mainTitle|${centerTitle}}`,
            left: 'center',
            top: 'center',
            textStyle: {
              fontSize: 12,
              color: '#6B7280',
              lineHeight: 18,
              rich: {
                mainTitle: { fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: 16, fontWeight: 600 },
              }
            }
          }
        ],
        legend: {
          bottom: 0,
          icon: 'circle'
        },
        layers: [
          {
            type: 'pie',
            radius: ['45%', '72%'],
            encoding: {
              x: 'name',
              y: 'value',
              color: 'name'
            },
            label: {
              formatter: '{b} {d}%',
              show: false
            },
            emphasis: {
              scale: true
            }
          }
        ]
      }
    }
  };
}

const mockChartDataset: Record<string, ChartAndTablePayload> = {
  revenue: createMockPayload('营收', 3723.65, 1),
  cost: createMockPayload('成本', 2488.15, 0.76),
  profit: createMockPayload('利润', 982.43, 0.52)
};

const resetState = () => {
  tabs.value = [];
  activeTabId.value = '';
  CHART_KEYS.forEach(key => {
    chartConfigs[key] = null;
  });
  tableColumns.value = [...baseTableColumns];
  tableRows.value = [];
  tableUnit.value = '亿';
  isFirstChartFromProps.value = true;
};

const bootstrap = async () => {
  await fetchTabs();
};

onMounted(() => {
  bootstrap();
});

watch(activeTabId, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    fetchCharts(newVal);
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
.report-select {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  background-color: rgba(255, 255, 255, 0.7);
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 500;
  color: #475569;
  box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  transition: all 0.2s ease;
}

.report-select:hover {
  background-color: rgba(248, 250, 252, 1);
}

:global(.dark) .report-select {
  border-color: rgba(51, 65, 85, 0.8);
  background-color: rgba(15, 23, 42, 0.6);
  color: #e2e8f0;
}

:global(.dark) .report-select:hover {
  background-color: rgba(30, 41, 59, 0.8);
}

.radio-container {
  overflow-x: auto;
  border-radius: 0.5rem;
  background-color: transparent;
  padding: 0.25rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.radio-container::-webkit-scrollbar {
  display: none;
}

:global(.dark) .radio-container {
  border-color: #334155;
  background-color: rgba(30, 41, 59, 0.6);
}

.radio-button-group {
  display: flex;
  min-width: max-content;
  gap: 0.5rem;
}

.radio-button-group :deep(.el-radio-button__inner) {
  border-radius: 4px;
  border: 1px solid transparent;
  background-color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  transition: background-color 0.2s ease;
  height: 26px;
  width: 68px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}

.radio-button-group :deep(.el-radio-button__inner:hover) {
  background-color: rgba(248, 250, 252, 1);
}

.radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: rgba(238, 242, 255, 1);
  color: #4338ca;
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.4);
  border-color: transparent;
}

:global(.dark) .radio-button-group :deep(.el-radio-button__inner) {
  background-color: #0f172a;
  color: #e2e8f0;
}

:global(.dark) .radio-button-group :deep(.el-radio-button__inner:hover) {
  background-color: #1e293b;
}

:global(.dark) .radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: rgba(74, 97, 214, 0.25);
  color: #c7d2fe;
}

/* 下拉菜单选中项样式 */
:deep(.el-dropdown-menu__item.is-active) {
  background-color: rgba(238, 242, 255, 1);
  color: #4338ca;
  font-weight: 500;
}
</style>