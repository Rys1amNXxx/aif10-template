<template>
  <!-- 全局暂无数据兜底 -->
  <div v-if="!reportOptions.length && !chartLoading && !reportOptionsLoading"
    class="flex h-48 items-center justify-center rounded-lg border border-dashed border-border-03 text-sm text-text-04 black:border-border-03-dark black:text-text-04-dark">
    暂无数据
  </div>

  <!-- 主要内容区域 -->
  <template v-else>
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
      <el-dropdown @command="handleReportChange" trigger="click" :disabled="reportOptionsLoading">
        <button type="button"
          class="flex items-center justify-center gap-1.5 w-[90px] h-[26px] rounded border text-xs font-normal transition-all duration-200
                   bg-white/80 border-border-03 text-text-02-01 hover:border-text-03-dark
                   black:bg-background-18-dark black:border-border-03-dark hover:black:border-text-04-dark black:text-text-02-01-dark black:shadow-[0_1px_2px_0_rgba(255,255,255,0.05)]"
          :class="{ 'opacity-60 cursor-wait': reportOptionsLoading }">
          <span>{{ reportOptionsLoading ? '加载中...' : (selectedReport || '请选择') }}</span>
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

    <!-- 原生表格 -->
    <div v-if="tableRows.length" class="overflow-x-auto">
      <table class="w-full text-xs border-collapse table-interactive" @mouseleave="clearHover">
        <!-- 表头 -->
        <thead>
          <tr class="bg-[#F2F5FA] text-text-03 black:bg-background-03-dark black:text-text-03-dark">
            <th colspan="2"
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center">
              业务名称
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(1)" @mouseenter="handleHeaderHover(1)" @click="handleHeaderClick(1)">
              营业收入（元）
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(2)" @mouseenter="handleHeaderHover(2)" @click="handleHeaderClick(2)">
              收入比例
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(3)" @mouseenter="handleHeaderHover(3)" @click="handleHeaderClick(3)">
              营业成本（元）
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(4)" @mouseenter="handleHeaderHover(4)" @click="handleHeaderClick(4)">
              成本比例
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center min-w-[110px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(5)" @mouseenter="handleHeaderHover(5)" @click="handleHeaderClick(5)">
              主营利润（元）
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[85px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(6)" @mouseenter="handleHeaderHover(6)" @click="handleHeaderClick(6)">
              利润比例
            </th>
            <th
              class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark font-medium text-center w-[80px] cursor-pointer transition-colors"
              :class="getHeaderCellClass(7)" @mouseenter="handleHeaderHover(7)" @click="handleHeaderClick(7)">
              毛利率
            </th>
          </tr>
        </thead>
        <!-- 表格内容 -->
        <tbody>
          <template v-for="(row, rowIndex) in tableRows" :key="rowIndex">
            <tr :class="getRowClass(rowIndex)">
              <!-- 分类列 - 动态 rowspan（不可交互） -->
              <td v-if="shouldShowCategoryCell(rowIndex)" :rowspan="getCategoryRowspan(rowIndex)" class="w-[70px] px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-center font-medium
                       bg-background-03 text-text-03 black:bg-background-03-dark black:text-text-03-dark align-middle">
                {{ row.category }}
              </td>
              <!-- 业务名称（点击选中整行） -->
              <td
                class="min-w-[140px] px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-center
                         bg-background-03 text-text-03 black:bg-background-03-dark black:text-text-03-dark cursor-pointer transition-colors"
                :class="getBusinessNameCellClass(rowIndex)" @mouseenter="hoverRowIndex = rowIndex"
                @click="handleBusinessNameClick(rowIndex)">
                {{ row.businessName }}
              </td>
              <!-- 数据列 -->
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark black:bg-background-01-dark text-right text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 2)" @mouseenter="handleCellHover(rowIndex, 2)"
                @click="handleCellClick(rowIndex, 2)">
                {{ formatAmount(row.revenue) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 3)" @mouseenter="handleCellHover(rowIndex, 3)"
                @click="handleCellClick(rowIndex, 3)">
                {{ formatPercent(row.revenueRatio) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 4)" @mouseenter="handleCellHover(rowIndex, 4)"
                @click="handleCellClick(rowIndex, 4)">
                {{ formatAmount(row.cost) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 5)" @mouseenter="handleCellHover(rowIndex, 5)"
                @click="handleCellClick(rowIndex, 5)">
                {{ formatPercent(row.costRatio) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 6)" @mouseenter="handleCellHover(rowIndex, 6)"
                @click="handleCellClick(rowIndex, 6)">
                {{ formatAmount(row.profit) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 7)" @mouseenter="handleCellHover(rowIndex, 7)"
                @click="handleCellClick(rowIndex, 7)">
                {{ formatPercent(row.profitRatio) }}
              </td>
              <td
                class="px-3 py-2 border border-[#EBEEF6] black:border-border-08-dark text-right black:bg-background-01-dark text-text-02-01 black:text-text-02-02-dark cursor-pointer transition-colors"
                :class="getDataCellClass(rowIndex, 8)" @mouseenter="handleCellHover(rowIndex, 8)"
                @click="handleCellClick(rowIndex, 8)">
                {{ formatPercent(row.grossMargin) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-else-if="!chartLoading"
      class="flex h-32 items-center justify-center rounded-lg border border-dashed border-border-03 text-sm text-text-04 black:border-border-03-dark black:text-text-04-dark">
      暂无明细数据
    </div>
  </template>

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
const chartPanels = componentConfig.staticConfig.chartPanels as { key: ChartCategory; title: string }[];

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
const selectedReport = ref('');
const reportOptions = ref<string[]>([]);
const reportOptionsLoading = ref(false);
const isDark = ref(false);

// 日期格式转换：将 "2024三季报" 转换为 "2024-09-30"
const convertReportToApiDate = (reportLabel: string): string => {
  const yearMatch = reportLabel.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  if (reportLabel.includes('一季报')) return `${year}-03-31`;
  if (reportLabel.includes('中报')) return `${year}-06-30`;
  if (reportLabel.includes('三季报')) return `${year}-09-30`;
  return `${year}-12-31`; // 年报
};

// 智能选择单位：根据数据大小自动选择亿/万
const detectUnit = (values: number[]): { unit: string; divisor: number } => {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return { unit: '元', divisor: 1 };

  const maxValue = Math.max(...validValues.map(Math.abs));
  if (maxValue >= 1e8) return { unit: '亿', divisor: 1e8 };
  if (maxValue >= 1e4) return { unit: '万', divisor: 1e4 };
  return { unit: '元', divisor: 1 };
};

// 业务维度映射：API返回的维度 -> 组件内部分类
const dimensionToCategoryMap: Record<string, string> = {
  'industry': '按行业',
  'product': '按产品',
  'area': '按地区'
};

// ========== 表格交互状态 ==========
// 悬停状态
const hoverColIndex = ref<number | null>(null);
const hoverRowIndex = ref<number | null>(null);

// 选中状态
const selectedColIndex = ref<number | null>(null);
const selectedRowIndex = ref<number | null>(null);
const selectedCell = ref<{ row: number; col: number } | null>(null);

const activeTabLabel = computed(() => tabs.value.find(item => item.id === activeTabId.value)?.label ?? '');

const baseTableColumns: TableColumn[] = componentConfig.staticConfig.tableColumns as TableColumn[];

// 业务名称归类规则
const businessCategoryMap: Record<string, string> = componentConfig.staticConfig.businessCategoryMap;

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
    // 没有 API 配置，清空数据
    tableRows.value = [];
    tableColumns.value = [];
    updatePieChartsForTab(activeTabId.value);
    return;
  }

  chartLoading.value = true;
  try {
    const url = processUrl(api.url);
    const params = processParams(api.params || {});

    // 注入当前选中的报告期日期
    if (selectedReport.value) {
      const specialDate = convertReportToApiDate(selectedReport.value);
      if (params.extensions) {
        params.extensions.specialDate = specialDate;
      }
    }

    const response = await axios({
      method: 'post',
      url,
      data: params
    });

    const apiData = response.data?.data?.data ?? [];
    // 将 API 返回的数据映射为组件内部格式
    const mappedRows = mapApiDataToTableRows(apiData);
    applyTableData({ table: { rows: mappedRows } });
  } catch (error) {
    console.error('获取主营构成数据失败:', error);
    // 请求失败时清空数据，显示"暂无数据"
    tableRows.value = [];
    tableColumns.value = [];
  } finally {
    chartLoading.value = false;
    isFirstChartFromProps.value = false;
    // 表格数据加载完成后，根据当前 tab 更新饼图
    updatePieChartsForTab(activeTabId.value);
  }
};

// 将 API 返回的数据映射为组件内部表格行格式
const mapApiDataToTableRows = (apiData: any[]): TableRow[] => {
  if (!Array.isArray(apiData) || apiData.length === 0) return [];

  // 提取所有营业收入值用于计算单位
  const revenueValues = apiData
    .map(item => parseFloat(item['营业收入']))
    .filter(v => !isNaN(v));

  const { unit, divisor } = detectUnit(revenueValues);
  tableUnit.value = unit;

  return apiData.map(item => {
    const revenue = parseFloat(item['营业收入']);
    const cost = parseFloat(item['营业成本']);
    const profit = parseFloat(item['营业利润']);
    const revenueRatio = parseFloat(item['营业收入占比']);
    const costRatio = parseFloat(item['营业成本占比']);
    const profitRatio = parseFloat(item['营业利润占比']);
    const grossMargin = parseFloat(item['毛利率']);

    return {
      businessName: item['业务名称'] || '',
      revenue: !isNaN(revenue) ? revenue / divisor : null,
      revenueRatio: !isNaN(revenueRatio) ? revenueRatio : null,
      cost: !isNaN(cost) ? cost / divisor : null,
      costRatio: !isNaN(costRatio) ? costRatio : null,
      profit: !isNaN(profit) ? profit / divisor : null,
      profitRatio: !isNaN(profitRatio) ? profitRatio : null,
      grossMargin: !isNaN(grossMargin) ? grossMargin : null,
      category: dimensionToCategoryMap[item['业务维度']] || '按行业'
    };
  });
};

// 应用表格数据
const applyTableData = (payload: ChartAndTablePayload | undefined) => {
  if (!payload?.table?.rows?.length) {
    tableRows.value = [];
    tableColumns.value = [];
    return;
  }

  tableRows.value = [...payload.table.rows];
  tableColumns.value = payload.table.columns?.length
    ? [...payload.table.columns]
    : [...baseTableColumns];

  // 如果 payload 中有 unit 则使用，否则保持 detectUnit 设置的值
  if (payload.table.unit) {
    tableUnit.value = payload.table.unit;
  }
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
      // 没有数据时设置为 null
      chartConfigs[key] = null;
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

  // 如果没有配置，清空 DOM 内容（防止旧图表滞留）
  if (!dom) return;
  if (!config) {
    dom.innerHTML = '';
    return;
  }
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
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'string') {
    // 如果是字符串数字，尝试转换
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const formatted = numValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return tableUnit.value ? `${formatted}${tableUnit.value}` : formatted;
    }
    return value;
  }
  const formatted = value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return tableUnit.value ? `${formatted}${tableUnit.value}` : formatted;
};

const formatPercent = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'string') {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // API 返回的是小数形式（如 0.85），需要转换为百分比
      return `${(numValue * 100).toFixed(2)}%`;
    }
    return value.includes('%') ? value : `${value}%`;
  }
  // 如果值小于1，认为是小数形式，需要乘以100
  const displayValue = value < 1 ? value * 100 : value;
  return `${displayValue.toFixed(2)}%`;
};

const cellAlignClass = (align: TableColumn['align']) => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const handleReportChange = (report: string) => {
  selectedReport.value = report;
  // watch(selectedReport) 会自动触发 fetchTableData
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

// ========== 表格交互事件处理 ==========
// 表头列定义（用于索引映射）
// 列索引: 0=分类, 1=业务名称, 2=营业收入, 3=收入比例, 4=营业成本, 5=成本比例, 6=主营利润, 7=利润比例, 8=毛利率
const HEADER_COL_RANGES = [
  { start: 0, end: 1, label: '业务名称' },
  { start: 2, end: 2, label: '营业收入' },
  { start: 3, end: 3, label: '收入比例' },
  { start: 4, end: 4, label: '营业成本' },
  { start: 5, end: 5, label: '成本比例' },
  { start: 6, end: 6, label: '主营利润' },
  { start: 7, end: 7, label: '利润比例' },
  { start: 8, end: 8, label: '毛利率' }
];

// 清除所有悬停状态
const clearHover = () => {
  hoverColIndex.value = null;
  hoverRowIndex.value = null;
};

// 处理表头悬停
const handleHeaderHover = (headerIndex: number) => {
  const range = HEADER_COL_RANGES[headerIndex];
  if (range) {
    // 对于 colspan 的表头，悬停时高亮整个范围
    hoverColIndex.value = range.start;
  }
};

// 处理表头点击
const handleHeaderClick = (headerIndex: number) => {
  const range = HEADER_COL_RANGES[headerIndex];
  if (!range) return;

  // 切换选中状态
  if (selectedColIndex.value === range.start) {
    selectedColIndex.value = null;
  } else {
    selectedColIndex.value = range.start;
  }
  // 点击列标题时清除单元格和行选中
  selectedCell.value = null;
  selectedRowIndex.value = null;
};

// 处理行标题（分类列）悬停
const handleRowHeaderHover = (rowIndex: number) => {
  hoverRowIndex.value = rowIndex;
  hoverColIndex.value = null;
};

// 处理行标题（分类列）点击
const handleRowHeaderClick = (rowIndex: number) => {
  if (selectedRowIndex.value === rowIndex) {
    selectedRowIndex.value = null;
  } else {
    selectedRowIndex.value = rowIndex;
  }
  // 清除列和单元格选中
  selectedColIndex.value = null;
  selectedCell.value = null;
};

// 处理业务名称单元格点击（选中整行）
const handleBusinessNameClick = (rowIndex: number) => {
  if (selectedRowIndex.value === rowIndex) {
    selectedRowIndex.value = null;
  } else {
    selectedRowIndex.value = rowIndex;
  }
  // 清除列和单元格选中
  selectedColIndex.value = null;
  selectedCell.value = null;
};

// 处理数据单元格悬停
const handleCellHover = (rowIndex: number, colIndex: number) => {
  hoverRowIndex.value = rowIndex;
  hoverColIndex.value = colIndex;
};

// 处理数据单元格点击
const handleCellClick = (rowIndex: number, colIndex: number) => {
  if (selectedCell.value?.row === rowIndex && selectedCell.value?.col === colIndex) {
    selectedCell.value = null;
  } else {
    selectedCell.value = { row: rowIndex, col: colIndex };
  }
  // 清除行列选中
  selectedColIndex.value = null;
  selectedRowIndex.value = null;
};

// 判断列是否在悬停的列范围内
const isColInHoverRange = (colIndex: number): boolean => {
  if (hoverColIndex.value === null) return false;
  // 检查是否是 colspan 的表头（业务名称跨 0-1 列）
  if (hoverColIndex.value === 0 && (colIndex === 0 || colIndex === 1)) {
    return true;
  }
  return hoverColIndex.value === colIndex;
};

// 判断列是否在选中的列范围内
const isColInSelectedRange = (colIndex: number): boolean => {
  if (selectedColIndex.value === null) return false;
  if (selectedColIndex.value === 0 && (colIndex === 0 || colIndex === 1)) {
    return true;
  }
  return selectedColIndex.value === colIndex;
};

// 获取表头单元格的样式类
const getHeaderCellClass = (headerIndex: number) => {
  const range = HEADER_COL_RANGES[headerIndex];
  if (!range) return '';

  const classes: string[] = [];

  // 悬停高亮
  if (hoverColIndex.value !== null && hoverColIndex.value >= range.start && hoverColIndex.value <= range.end) {
    classes.push('th-col-hover');
  }

  // 选中状态（点击列标题时整列选中）
  if (selectedColIndex.value !== null && selectedColIndex.value >= range.start && selectedColIndex.value <= range.end) {
    classes.push('th-col-selected');
  }

  // 单元格选中时，对应列标题的下边框指示
  if (selectedCell.value !== null && selectedCell.value.col >= range.start && selectedCell.value.col <= range.end) {
    classes.push('th-cell-indicator');
  }

  return classes.join(' ');
};

// 获取行标题（分类列 / 业务名称列）的样式类
const getRowHeaderClass = (rowIndex: number, isCategory: boolean = false) => {
  const classes: string[] = [];

  // 行悬停
  if (hoverRowIndex.value === rowIndex) {
    classes.push('row-hover');
  }

  // 列悬停（分类列 colIndex=0，业务名称列 colIndex=1）
  const colIndex = isCategory ? 0 : 1;
  if (isColInHoverRange(colIndex)) {
    classes.push('col-hover');
  }

  // 行选中
  if (selectedRowIndex.value === rowIndex) {
    classes.push('row-selected');
    if (isCategory) {
      classes.push('row-selected-first-col');
    }
  }

  // 列选中
  if (isColInSelectedRange(colIndex)) {
    classes.push('col-selected');
    if (rowIndex === 0) classes.push('col-selected-first');
    if (rowIndex === tableRows.value.length - 1) classes.push('col-selected-last');
  }

  // 单元格选中时的行标题指示（右边框变色）
  if (selectedCell.value !== null && selectedCell.value.row === rowIndex) {
    classes.push('cell-indicator-row');
  }

  return classes.join(' ');
};

// 获取业务名称单元格的样式类（点击选中整行）
const getBusinessNameCellClass = (rowIndex: number) => {
  const classes: string[] = [];

  // 行悬停
  if (hoverRowIndex.value === rowIndex) {
    classes.push('row-hover');
  }

  // 行选中（点击业务名称时整行高亮）
  if (selectedRowIndex.value === rowIndex) {
    classes.push('row-selected');
    classes.push('row-selected-first-col');
  }

  // 单元格选中时的行标题指示（右边框变色）
  if (selectedCell.value !== null && selectedCell.value.row === rowIndex) {
    classes.push('cell-indicator-row');
  }

  return classes.join(' ');
};

// 获取数据单元格的样式类
const getDataCellClass = (rowIndex: number, colIndex: number) => {
  const classes: string[] = [];

  // 行悬停
  if (hoverRowIndex.value === rowIndex) {
    classes.push('row-hover');
  }

  // 列悬停
  if (isColInHoverRange(colIndex)) {
    classes.push('col-hover');
  }

  // 单元格本身悬停（行+列同时悬停）
  if (hoverRowIndex.value === rowIndex && isColInHoverRange(colIndex)) {
    classes.push('cell-hover');
  }

  // 行选中
  if (selectedRowIndex.value === rowIndex) {
    classes.push('row-selected');
    if (colIndex === tableRows.value.length) {
      classes.push('row-selected-last-col');
    }
  }

  // 列选中
  if (isColInSelectedRange(colIndex)) {
    classes.push('col-selected');
    if (rowIndex === 0) classes.push('col-selected-first');
    if (rowIndex === tableRows.value.length - 1) classes.push('col-selected-last');
  }

  // 单元格选中
  if (selectedCell.value?.row === rowIndex && selectedCell.value?.col === colIndex) {
    classes.push('cell-selected');
  }

  return classes.join(' ');
};

// 获取行的样式类
const getRowClass = (rowIndex: number) => {
  const classes: string[] = ['bg-background-00', 'black:bg-background-00-dark'];

  if (selectedRowIndex.value === rowIndex) {
    classes.push('tr-row-selected');
  }

  return classes.join(' ');
};

// 创建饼图配置
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

// 获取报告期选项列表
const fetchReportOptions = async () => {
  const api = getApiByAlias('reportOptions');
  if (!api) {
    // 没有 API 配置，无法获取数据
    reportOptions.value = [];
    selectedReport.value = '';
    return;
  }

  reportOptionsLoading.value = true;
  try {
    const url = processUrl(api.url);
    const params = processParams(api.params || {});

    const response = await axios({
      method: 'post',
      url,
      data: params
    });

    const rows = response.data?.data?.rows ?? [];
    // 从 rows 中提取 year 字段作为下拉选项
    const options = rows.map((row: any) => row.year).filter(Boolean);
    reportOptions.value = options;
    // 默认选中第一个（最新的）
    selectedReport.value = reportOptions.value[0] || '';
  } catch (error) {
    console.error('获取报告期选项失败:', error);
    // 请求失败时清空数据
    reportOptions.value = [];
    selectedReport.value = '';
  } finally {
    reportOptionsLoading.value = false;
  }
};

const bootstrap = async () => {
  initTabs();
  await fetchReportOptions();  // 只获取下拉选项，表格数据通过 watch selectedReport 触发
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

// 监听报告期选择变化，触发表格数据请求
watch(selectedReport, (newVal, oldVal) => {
  if (newVal && newVal !== oldVal) {
    fetchTableData();
  }
});
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

/* ========== 表格交互样式 ========== */

/* 表格容器 */
.table-interactive {
  user-select: none;
}

/* ---------- 悬停效果 ---------- */

/* 表头列悬停 */
.th-col-hover {
  background-color: #EBEEF6 !important;
}

/* 行悬停 */
.row-hover {
  background-color: #F5F7FA !important;
}

/* 列悬停 */
.col-hover {
  background-color: #F5F7FA !important;
}

/* 单元格悬停（行+列交叉） */
.cell-hover {
  background-color: #EDF0F7 !important;
  box-shadow: inset 0 0 0 1px #C5CAD9;
}

/* ---------- 选中效果 ---------- */

/* 表头列选中 */
.th-col-selected {
  background-color: #EEF0FF !important;
  border-left: 2px solid #636FFF !important;
  border-right: 2px solid #636FFF !important;
  border-top: 2px solid #636FFF !important;
}

/* 列选中（数据单元格） */
.col-selected {
  /* background-color: #F8F9FF !important; */
  border-left: 2px solid #636FFF !important;
  border-right: 2px solid #636FFF !important;
}

/* 列选中 - 最后一行 */
.col-selected-last {
  border-bottom: 2px solid #636FFF !important;
}

/* 行选中 */
.row-selected {
  background-color: #F8F9FF !important;
  border-top: 2px solid #636FFF !important;
  border-bottom: 2px solid #636FFF !important;
}

/* 行选中 - 第一列（左边框） */
.row-selected-first-col {
  border-left: 2px solid #636FFF !important;
}

/* 行选中 - 最后列（右边框） */
.row-selected-last-col {
  border-right: 2px solid #636FFF !important;
}

/* 单元格选中 */
.cell-selected {
  background-color: #F0F2FF !important;
  outline: 2px solid #636FFF;
  outline-offset: -2px;
  position: relative;
  z-index: 1;
}

/* 单元格选中时的行标题指示（右边框变色） */
.cell-indicator-row {
  background-color: #F0F2FF !important;
  border-right: 2px solid #636FFF !important;
}

/* 单元格选中时的列标题指示（表头下边框变色） */
.th-cell-indicator {
  background-color: #F0F2FF !important;
  border-bottom: 2px solid #636FFF !important;
}

/* tr 行选中辅助样式 - 限定在 table-interactive 内 */
.table-interactive .tr-row-selected td:last-child {
  border-right: 2px solid #636FFF !important;
}
</style>

<!-- 暗黑模式样式需要在非 scoped 块中，并限定作用域 -->
<style>
/* 暗黑模式 - 表格悬停效果 */
.dark .table-interactive .th-col-hover {
  background-color: #2A3654 !important;
}

.dark .table-interactive .row-hover {
  background-color: #1E2942 !important;
}

.dark .table-interactive .col-hover {
  background-color: #1E2942 !important;
}

.dark .table-interactive .cell-hover {
  background-color: #263050 !important;
  box-shadow: inset 0 0 0 1px #3D4A6B;
}

/* 暗黑模式 - 表格选中效果 */
.dark .table-interactive .th-col-selected {
  background-color: #2C375D !important;
}

.dark .table-interactive .col-selected {
  background-color: #252F4D !important;
}

.dark .table-interactive .row-selected {
  background-color: #252F4D !important;
}

.dark .table-interactive .cell-selected {
  background-color: #2C375D !important;
}

.dark .table-interactive .cell-indicator-row {
  background-color: #2C375D !important;
}

.dark .table-interactive .th-cell-indicator {
  background-color: #2C375D !important;
}
</style>
