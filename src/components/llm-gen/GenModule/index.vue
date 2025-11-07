<template>
  <div class="w-full flex flex-col gap-4">
    <!-- 柱折图可视化组件 -->
    <div class="w-full h-[400px]" ref="chartRef"></div>
    
    <!-- 表格可视化组件 -->
    <div class="w-full h-auto" ref="tableRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';

interface Props {
  params: {
    apis: Array<{
      method: string;
      isFirstScreen: boolean;
      alias: string;
      url: string;
      params: Record<string, any>;
    }>;
    token?: string;
    hook?: Function;
    view?: any[];
    [key: string]: any;
  };
  data?: any;
}

const props = defineProps<Props>();

// 响应式数据
const chartRef = ref<HTMLElement | null>(null);
const tableRef = ref<HTMLElement | null>(null);
const chartData = ref<any>(null);
const tableData = ref<any>(null);
const loading = ref(false);
const isFirstRender = ref(true);

// 获取数据
const fetchData = async () => {
  // 如果外部传入了首屏数据，直接使用
  if (isFirstRender.value && props.data) {
    chartData.value = props.data.bartable;
    tableData.value = props.data.bartable;
    isFirstRender.value = false;
    return;
  }

  loading.value = true;
  try {
    const api = props.params.apis.find(api => api.alias === 'bartable');
    if (!api) return;

    const url = processUrl(api.url);
    const method = api.method.toLowerCase();
    const params = processParams(api.params);

    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });

    chartData.value = response.data;
    tableData.value = response.data;
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
};

// 渲染图表
const renderVisualizations = () => {
  if (!chartRef.value || !tableRef.value || !chartData.value) return;

  nextTick(() => {
    try {
      // 渲染柱折图
      if (chartRef.value) {
        const chartParams = {
          ...props.params,
          data: [{
            metadata: chartData.value.input,
            values: chartData.value.data
          }],
          view: props.params.amisConfig.view?.[0] // 使用第一个视图配置
        };
        console.log(chartParams);
        window.AIGCDataVis.render(chartRef.value, chartParams);
      }

      // 渲染表格
      if (tableRef.value) {
        const tableParams = {
          ...props.params,
          data: [{
            metadata: tableData.value.input,
            values: tableData.value.data
          }],
          view: props.params.amisConfig.view?.[1] // 使用第二个视图配置
        };
        console.log(tableParams);
        window.AIGCDataVis.render(tableRef.value, tableParams);
      }
    } catch (error) {
      console.error('渲染可视化组件失败:', error);
    }
  });
};

// 生命周期
onMounted(async () => {
  await fetchData();
  renderVisualizations();
});

// 监听数据变化
watch(() => props.data, async (newVal) => {
  if (newVal) {
    chartData.value = newVal;
    tableData.value = newVal;
    renderVisualizations();
  }
}, { deep: true });
</script>
