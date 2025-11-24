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
          <DropdownArrow class="text-text-11 black:text-text-02-01-dark rotate-180" />
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

    <el-table v-if="tableRows.length" :data="tableRows" :span-method="objectSpanMethod" class="main-business-table"
      border size="small">
      <el-table-column label="业务名称" align="center">
        <el-table-column prop="category" width="70" align="center" />
        <el-table-column prop="businessName" min-width="140" align="center" />
      </el-table-column>
      <el-table-column prop="revenue" label="营业收入（元）" align="right" min-width="110">
        <template #default="{ row }">
          {{ formatAmount(row.revenue) }}
        </template>
      </el-table-column>
      <el-table-column prop="revenueRatio" label="收入比例" align="right" width="85">
        <template #default="{ row }">
          {{ formatPercent(row.revenueRatio) }}
        </template>
      </el-table-column>
      <el-table-column prop="cost" label="营业成本（元）" align="right" min-width="110">
        <template #default="{ row }">
          {{ formatAmount(row.cost) }}
        </template>
      </el-table-column>
      <el-table-column prop="costRatio" label="成本比例" align="right" width="85">
        <template #default="{ row }">
          {{ formatPercent(row.costRatio) }}
        </template>
      </el-table-column>
      <el-table-column prop="profit" label="主营利润（元）" align="right" min-width="110">
        <template #default="{ row }">
          {{ formatAmount(row.profit) }}
        </template>
      </el-table-column>
      <el-table-column prop="profitRatio" label="利润比例" align="right" width="85">
        <template #default="{ row }">
          {{ formatPercent(row.profitRatio) }}
        </template>
      </el-table-column>
      <el-table-column prop="grossMargin" label="毛利率" align="right" width="80">
        <template #default="{ row }">
          {{ formatPercent(row.grossMargin) }}
        </template>
      </el-table-column>
    </el-table>
    <div v-else
      class="flex h-32 items-center justify-center rounded-lg border border-dashed border-border-03 text-sm text-text-04 black:border-border-03-dark black:text-text-04-dark">
      暂无明细数据
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

// 业务名称归类规则
const businessCategoryMap: Record<string, string> = {
  '服务贸易及其他': '按行业',
  '金融业务': '按行业',
  '整车业务': '按产品',
  '零部件业务': '按产品',
  '服务贸易（产品）': '按产品',
  '金融业务（产品）': '按产品',
  '中国': '按地区',
  '其他': '按地区',
  '其他地区': '按地区'
};

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

const baseBusinessRows = [
  { businessName: '服务贸易及其他', revenue: 3554.64, revenueRatio: 97.12, cost: 2555.55, costRatio: 99.56, profit: 736.58, profitRatio: 82.36, grossMargin: 10.17, category: '按行业' },
  { businessName: '金融业务', revenue: 185.23, revenueRatio: 2.48, cost: 26.36, costRatio: 0.41, profit: 158.17, profitRatio: 17.61, grossMargin: 85.45, category: '按行业' },
  { businessName: '整车业务', revenue: 5023.36, revenueRatio: 67.56, cost: 4753.14, costRatio: 72.25, profit: 238.35, profitRatio: 32.52, grossMargin: 5.79, category: '按产品' },
  { businessName: '零部件业务', revenue: 1828.25, revenueRatio: 25.23, cost: 1525.22, costRatio: 22.36, profit: 355.96, profitRatio: 39.64, grossMargin: 19.46, category: '按产品' },
  { businessName: '服务贸易及其他', revenue: 373.56, revenueRatio: 5.1, cost: 232.43, costRatio: 2.43, profit: 123.35, profitRatio: 9.49, grossMargin: 19.28, category: '按产品' },
  { businessName: '金融业务', revenue: 185.06, revenueRatio: 2.55, cost: 26.36, costRatio: 0.41, profit: 158.58, profitRatio: 17.62, grossMargin: 85.36, category: '按产品' },
  { businessName: '中国', revenue: 373.56, revenueRatio: 5.1, cost: 288.88, costRatio: 4.4, profit: 91.36, profitRatio: 10.17, grossMargin: 23.07, category: '按地区' },
  { businessName: '其他', revenue: 253.32, revenueRatio: 4.76, cost: 195.73, costRatio: 2.77, profit: 43.58, profitRatio: 5.73, grossMargin: 31.54, category: '按地区' }
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

// 单元格合并方法
const objectSpanMethod = ({ row, column, rowIndex, columnIndex }: any) => {
  // 只对第一列（分类列）进行合并
  if (columnIndex === 0) {
    const currentCategory = row.category;

    // 计算当前分类的起始行索引
    let startIndex = rowIndex;
    while (startIndex > 0 && tableRows.value[startIndex - 1]?.category === currentCategory) {
      startIndex--;
    }

    // 如果当前行不是该分类的第一行，隐藏该单元格
    if (startIndex !== rowIndex) {
      return { rowspan: 0, colspan: 0 };
    }

    // 计算当前分类的总行数
    let rowspan = 1;
    let nextIndex = rowIndex + 1;
    while (nextIndex < tableRows.value.length && tableRows.value[nextIndex]?.category === currentCategory) {
      rowspan++;
      nextIndex++;
    }

    return { rowspan, colspan: 1 };
  }

  return { rowspan: 1, colspan: 1 };
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
/* 下拉菜单按钮 */
.report-select {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  border-radius: 4px;
  border: 1px solid rgba(224, 228, 234, 1);
  background-color: var(--background-01);
  font-size: 12px;
  line-height: 1.25rem;
  font-weight: 400;
  color: #2A354E;
  transition: all 0.2s ease;
  width: 90px;
  height: 26px;
}

.report-select:hover {
  background-color: var(--background-03);
}

:global(.dark) .report-select {
  box-shadow: 0 1px 2px 0 rgba(255, 255, 255, 0.05);
}

/* 下拉菜单选中项样式 */
:deep(.el-dropdown-menu__item.is-active) {
  background-color: var(--background-07);
  color: var(--text-05);
  font-weight: 500;
}

:global(.dark) :deep(.el-dropdown-menu__item.is-active) {
  background-color: var(--background-07-dark);
  color: var(--text-05-dark);
}

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

:global(.dark) .radio-container {
  background-color: var(--background-03-dark);
}

.radio-button-group {
  display: flex;
  min-width: max-content;
  gap: 0.5rem;
}

/* 按钮样式 */
.radio-button-group :deep(.el-radio-button__inner) {
  border-radius: 4px;
  border: 1px solid rgba(224, 228, 234, 1);
  background-color: var(--background-00);
  font-size: 12px;
  font-weight: 400;
  color: #2A354E;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
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
  background-color: var(--background-03);
}

.radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: #E7EAFA;
  color: #636FFF;
  box-shadow: inset 0 0 0 1px var(--border-04);
  border-color: #636FFF;
}

/* 暗色主题 */
:global(.dark) .radio-button-group :deep(.el-radio-button__inner) {
  background-color: var(--background-00-dark);
  color: var(--text-03-dark);
  box-shadow: 0 1px 2px 0 rgba(255, 255, 255, 0.05);
}

:global(.dark) .radio-button-group :deep(.el-radio-button__inner:hover) {
  background-color: var(--background-03-dark);
}

:global(.dark) .radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: var(--background-07-dark);
  color: var(--text-05-dark);
  box-shadow: inset 0 0 0 1px var(--border-04-dark);
}

/* Element Plus 表格样式覆盖 */
.main-business-table {
  font-size: 12px;
}

.main-business-table :deep(.el-table__header) {
  background-color: var(--background-03);
}

:global(.dark) .main-business-table :deep(.el-table__header) {
  background-color: var(--background-03-dark);
}

.main-business-table :deep(.el-table__header th) {
  background-color: var(--background-03);
  color: var(--text-04);
  font-weight: 500;
  font-size: 12px;
  padding: 6px 8px;
  height: 32px;
  border: 1px solid rgba(235,238,246,1);
}

:global(.dark) .main-business-table :deep(.el-table__header th) {
  background-color: var(--background-03-dark);
  color: var(--text-04-dark);
}

.main-business-table :deep(.el-table__body tr) {
  background-color: var(--background-00);
}

:global(.dark) .main-business-table :deep(.el-table__body tr) {
  background-color: var(--background-00-dark);
}

.main-business-table :deep(.el-table__body td) {
  color: var(--text-02-01);
  font-size: 12px;
  padding: 6px 8px;
  height: 36px;
  border: 1px solid rgba(235,238,246,1);
}

:global(.dark) .main-business-table :deep(.el-table__body td) {
  color: var(--text-02-01-dark);
  border-color: var(--border-03-dark);
}

.main-business-table :deep(.el-table__body tr:hover > td) {
  background-color: var(--background-03) !important;
}

:global(.dark) .main-business-table :deep(.el-table__body tr:hover > td) {
  background-color: var(--background-03-dark) !important;
}

.main-business-table :deep(.el-table td.el-table__cell),
.main-business-table :deep(.el-table th.el-table__cell.is-leaf) {
  border-color: var(--border-03);
}

:global(.dark) .main-business-table :deep(.el-table td.el-table__cell),
:global(.dark) .main-business-table :deep(.el-table th.el-table__cell.is-leaf) {
  border-color: var(--border-03-dark);
}

/* 隐藏多级表头产生的第二行空表头 */
.main-business-table :deep(.el-table__header tr:nth-child(2)) {
  display: none;
}

/* 第一列（分类列）居中加粗 */
.main-business-table :deep(.el-table__body td:first-child) {
  font-weight: 500;
  color: var(--text-01);
  text-align: center;
}

:global(.dark) .main-business-table :deep(.el-table__body td:first-child) {
  color: var(--text-01-dark);
}
</style>