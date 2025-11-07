<template>
  <div class="w-full flex flex-col">
    <!-- 单选框UI组件 -->
    <div class="mb-1 radio-container" ref="radioContainerRef">
      <el-radio-group v-model="selectedBusinessId" class="radio-button-group" @change="handleRadioChange">
        <el-radio-button 
          v-for="(item, index) in businessData" 
          :key="item.id" 
          :label="item.id"
          :ref="el => setRadioButtonRef(el, item.id)"
        >{{ item.name }}</el-radio-button>
      </el-radio-group>
    </div>
    
    <!-- 散点图可视化组件 -->
    <div class="w-full h-[400px]" ref="chartRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import axios from 'axios';
import { processUrl, processParams } from '@/common/utils/params-processor';

// 定义接口
interface BusinessItem {
  id: string;
  name: string;
}

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
    token?: string;
    hook?: Function;
    [key: string]: any;
  };
  data?: any;
}

const props = defineProps<Props>();

// 响应式数据
const chartRef = ref<HTMLElement | null>(null);
const businessData = ref<BusinessItem[]>([]);
const selectedBusinessId = ref('');
const scatterData = ref<any>(null);
const loading = ref(false);
const isFirstRenderChart = ref(true); // 标记图表是否是首次渲染
const radioContainerRef = ref<HTMLElement | null>(null);
const radioButtonRefs = ref<Map<string, HTMLElement>>(new Map());

// 获取业务列表数据
const fetchBusinessData = async () => {
  // tabs数据可以一直使用（若有）
  if (props.data && props.data.tabs && Array.isArray(props.data.tabs.business_name_list)) {
    businessData.value = props.data.tabs.business_name_list;
    if (businessData.value.length > 0) {
      selectedBusinessId.value = businessData.value[0].id;
    }
    console.log('businessData', businessData.value);
    return;
  }
  
  loading.value = true;
  try {
    const tabsApi = props.params.apis.find(api => api.alias === 'tabs');
    if (!tabsApi) return;
    
    const url = processUrl(tabsApi.url);
    const method = tabsApi.method.toLowerCase();
    const params = processParams(tabsApi.params);
    
    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });
    // 兼容接口返回结构
    businessData.value = response.data.business_name_list || [];
    if (businessData.value.length > 0) {
      selectedBusinessId.value = businessData.value[0].id;
    }
  } catch (error) {
    console.error('获取业务列表失败:', error);
  } finally {
    loading.value = false;
  }
};

// 获取散点图数据
const fetchScatterData = async () => {
  // 图表数据只在第一次渲染时使用
  if (isFirstRenderChart.value && props.data && props.data.scatter) {
    scatterData.value = props.data.scatter;
    isFirstRenderChart.value = false; // 标记图表首次渲染完成
    return;
  }
  
  // 如果未选择业务ID，则不请求
  if (!selectedBusinessId.value) return;
  
  loading.value = true;
  try {
    const scatterApi = props.params.apis.find(api => api.alias === 'scatter');
    if (!scatterApi) return;
    
    // 检查依赖关系
    const hasDependencies = scatterApi.depends && scatterApi.depends.includes('tabs');
    if (hasDependencies && (!businessData.value || businessData.value.length === 0)) {
      console.warn('散点图依赖tabs数据，但tabs数据尚未加载');
      return;
    }
    
    // 构建API数据，包含tabs数据
    const apiData = {
      tabs: {
        business_name_list: businessData.value
      }
    };
    
    const url = processUrl(scatterApi.url);
    const method = scatterApi.method.toLowerCase();
    
    // 处理依赖参数，例如 business_id
    const params = processParams(scatterApi.params, apiData);
    if (params.extensions && typeof params.extensions.business_id === 'string') {
      // 替换为当前选中的业务ID
      params.extensions.business_id = selectedBusinessId.value;
    }
    
    const response = await axios({
      method,
      url,
      params: method === 'get' ? params : undefined,
      data: method !== 'get' ? params : undefined
    });
    scatterData.value = response.data.data; // 直接赋整个对象
  } catch (error) {
    console.error('获取散点图数据失败:', error);
  } finally {
    loading.value = false;
  }
};

// 渲染图表
const renderChart = () => {
  if (!chartRef.value || !scatterData.value) return;
  
  nextTick(() => {
    try {
      // 使用全局的AIGCDatavis渲染散点图
      if (chartRef.value) {
        const tempParams = {
          ...props.params,
          data: [{
            metadata: scatterData.value.input,
            values: scatterData.value.data
          }]
        }
        console.log(tempParams);
        // 确保组件中请求的数据优先级高于params中的数据
        window.AIGCDataVis.render(chartRef.value, tempParams);
      }
    } catch (error) {
      console.error('渲染图表失败:', error);
    }
  });
};

// 生命周期
onMounted(async () => {
  // 只在组件挂载时请求一次tabs数据
  await fetchBusinessData();
  
  // 获取到tabs数据后，根据选中的业务ID获取散点图数据
  if (selectedBusinessId.value) {
    await fetchScatterData();
    renderChart();
  }
});

// 监听业务数据变化
watch(() => businessData.value, () => {
  if (businessData.value.length > 0 && !selectedBusinessId.value) {
    selectedBusinessId.value = businessData.value[0].id;
  }
  // 当业务数据加载完成后，滚动到选中项
  nextTick(() => {
    if (selectedBusinessId.value) {
      scrollToCenter(selectedBusinessId.value);
    }
  });
}, { deep: true });

// 监听选中的业务ID变化，重新获取散点图数据
watch(() => selectedBusinessId.value, async (newVal, oldVal) => {
  if(isFirstRenderChart.value) return;
  if (newVal && newVal !== oldVal) {
    await fetchScatterData();
    renderChart();
    // 当选中项变化时，滚动到中心（如果不是通过点击触发的）
    nextTick(() => {
      scrollToCenter(newVal);
    });
  }
});

// 设置单选框按钮的ref
const setRadioButtonRef = (el: any, id: string) => {
  if (el && el.$el) {
    // el-radio-button组件实例，需要获取其DOM元素
    radioButtonRefs.value.set(id, el.$el as HTMLElement);
  } else if (el) {
    radioButtonRefs.value.set(id, el as HTMLElement);
  } else {
    radioButtonRefs.value.delete(id);
  }
};

// 滚动到选中项的中心位置
const scrollToCenter = (selectedId: string) => {
  const container = radioContainerRef.value;
  const selectedElement = radioButtonRefs.value.get(selectedId);
  
  if (!container || !selectedElement) return;
  
  const containerRect = container.getBoundingClientRect();
  const elementRect = selectedElement.getBoundingClientRect();
  
  // 计算元素相对于容器的位置
  const elementLeft = elementRect.left - containerRect.left + container.scrollLeft;
  const elementWidth = elementRect.width;
  const containerWidth = containerRect.width;
  
  // 计算目标滚动位置（让选中项居中）
  const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2;
  
  // 平滑滚动到目标位置
  container.scrollTo({
    left: Math.max(0, targetScrollLeft),
    behavior: 'smooth'
  });
};

// 处理单选框变化
const handleRadioChange = (value: string | number | boolean | undefined) => {
  if (typeof value === 'string') {
    // 延迟执行滚动，确保DOM更新完成
    nextTick(() => {
      scrollToCenter(value);
    });
  }
};
</script>

<script lang="ts">
// 为了TypeScript全局类型声明
declare global {
  interface Window {
    AIGCDatavis: {
      render: (dom: HTMLElement, params: any) => void;
    }
  }
}
</script>

<style scoped>
.radio-container {
  overflow-x: auto;
  overflow-y: hidden;
  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  background: var(--atom-tabs-wrapper-background);
  border-radius: 4px;
  padding: 4px;
  scroll-behavior: smooth; /* 添加平滑滚动 */
}

.radio-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

.radio-button-group {
  display: flex;
  flex-wrap: nowrap;
  white-space: nowrap;
  min-width: max-content;
}

.radio-button-group :deep(.el-radio-button__inner) {
  padding: 8px 10px;
  border-radius: 4px;
  margin: 1px 4px;
  font-size: var(--atom-tabs-block-font-size);
  height: var(--atom-tabs-block-height);
  line-height: calc(var(--atom-tabs-block-height) - 16px);
  white-space: nowrap;
  background-color: var(--atom-tabs-block-plain-background-color);
  border: 1px solid var(--atom-tabs-block-plain-border-color);
  color: var(--atom-tabs-block-color);
  transition: all 0.2s ease;
  box-shadow: none;
}

.radio-button-group :deep(.el-radio-button__inner:hover) {
  background: var(--atom-tabs-block-plain-hover-background-color);
}

.radio-button-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
  margin: 1px 4px 1px 0;
}

.radio-button-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
  margin: 1px 0 1px 4px;
}

.radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background-color: var(--atom-tabs-block-plain-active-background-color);
  color: var(--atom-tabs-block-plain-active-color);
  border: var(--atom-tabs-block-plain-border);
}

/* 覆盖默认的box-shadow样式 */
.radio-button-group :deep(.el-radio-button.is-active .el-radio-button__original-radio:not(:disabled)+.el-radio-button__inner) {
  box-shadow: none;
}

.radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner:hover) {
  background: var(--atom-tabs-block-plain-active-background-color);
}

/* 黑暗模式悬停效果 */
:global(.dark) .radio-button-group :deep(.el-radio-button__inner:hover) {
  background: var(--atom-tabs-block-plain-hover-background-color);
}

:global(.dark) .radio-button-group :deep(.el-radio-button.is-active .el-radio-button__inner:hover) {
  background: var(--atom-tabs-block-plain-active-background-color);
}
</style>