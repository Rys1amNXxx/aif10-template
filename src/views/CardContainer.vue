<template>
  <div
    class="card border-base-card align-top z-0 after:rounded-md m-1 rounded-md pt-3 px-5 pb-5 text-text-01 black:text-text-01-dark bg-background-01 black:bg-background-01-dark inline-block hover:shadow-select-section black:hover:shadow-select-section-dark hover:z-10"
    ref="cardEl"
    :style="moduleStyle"
  >
    <div v-show="loading" class=" absolute left-0 top-0 w-full h-full overflow-hidden -z-10 pt-3 px-5 pb-5">
      <el-skeleton :rows="skeletonRows" animated />
    </div>
    <!-- 卡片标题 -->
    <div v-show="showTitle && !loading" class="text-base font-semibold flex justify-start items-center gap-2 relative">
      <span class="w-1 h-4 bg-title-bar absolute -left-5 rounded-r-[100px]"></span>
      <span class="flex-1 truncate">{{ section.title }}</span>
    </div>
    <!-- 多维数据tab -->
    <el-radio-group
      v-model="activeTabIndex"
      size="small"
      v-if="section.view_wrapper.views.length > 1"
      @change="changeViewIndex"
    >
      <el-radio-button
        v-for="(view, index) in section.view_wrapper.views"
        :key="view.name"
        :label="view.name"
        :value="index"
      />
    </el-radio-group>
    <!-- 组件内容展示区 -->
    <div
      ref="chartContent"
      @click="stopPropagation"
      v-show="loading || renderHandler?.isDataValid()"
      class="mt-3"
      :class="{ 'h-auto': renderHandler?.fitHeight,
        'intro-card': showGuide }"
      :style="chartContentStyle"
    >
    <el-skeleton v-show="!loading" :rows="skeletonRows" animated />
   </div>
    <!-- 无数据态 -->
    <div v-show="!loading && !renderHandler?.isDataValid()" class="h-[212px] mt-3 flex-common flex-col gap-4">
      <span class="w-[60px] h-[60px] bg-nodata black:bg-nodata-dark bg-full bg-no-repeat bg-center"></span>
      <span class="text-xs text-text-04 black:text-text-04-dark"
        >该股暂无【{{ section.title }}】的相关数据</span
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import type { AIF10Section, QueryStatus, Section } from '@/common/models/recommend-result'
import { useComponentRender } from './services/component-render'
import { nextTick, ref, computed, watch, onMounted } from 'vue'
import { useAppInfoStore } from '@/stores/app'

const props = defineProps<{
  section: Section
  status?: QueryStatus,
  firstScreen?: boolean,
  sectionIndex?: number,
  dataRequest?: Promise<AIF10Section | null>
}>()

// 多维数据tab当前激活下标
const activeTabIndex = ref(props.section.view_index < 0 ? 0 : props.section.view_index)

// 组件内容Dom
const chartContent = ref()

// 卡片Dom
const cardEl = ref<HTMLElement | null>(null)
const loading = ref(true)
const isInView = ref(false)

const appStore = useAppInfoStore()

const skin = computed(() => appStore.skin)

// 是否展示标题
const showTitle = computed(() => props.section.extension.showTitle !== false)

// 是否展示引导
const showGuide = computed(() => props.section.extension.showGuide && props.section.extension.index === props.sectionIndex)

// 展示骨架图行数
const skeletonRows = computed(() => props.section.extension.skeletonRows || 5)

// 是否支持IntersectionObserver
const isSupported =
  'IntersectionObserver' in window &&
  'IntersectionObserverEntry' in window &&
  'isIntersecting' in IntersectionObserverEntry.prototype;


// 模块样式
const moduleStyle = computed(() => {
  const extensionStyle = props.section.extension.moduleStyle || {}
  return {
    width: renderHandler.value?.fullWidth ? 'calc(100% - 8px)' : 'calc(50% - 8px)',
    ...extensionStyle
  }
})

// 图表内容样式
const chartContentStyle = computed(() => {
  const extensionStyle = props.section.extension.chartStyle || {}
  return { 
    minHeight: loading.value ? renderHandler.value?.loadingHeight : 'auto',
    height: renderHandler.value?.fitHeight ? 'auto' : renderHandler.value?.chartHeight ,
    ...extensionStyle
  }
})

// 渲染器
let renderHandler = ref()
renderHandler.value = useComponentRender(chartContent, props.section, 'page')
onMounted(async () => {
  if (props.firstScreen || !isSupported) {
    initView();
  } else {
    initObserver();
  }
})

// 动态加载
function initObserver() {
  // 创建 Intersection Observer
  let observer: IntersectionObserver | null = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isInView.value) {
        isInView.value = true;
        initView();
        // 一旦初始化完成，就不再需要观察
        observer?.disconnect();
        observer = null;
      }
    });
  }, {
    root: document.getElementById('mainContainer'),
    rootMargin: '200px 0px', // 提前 200px 触发
    threshold: 0
  });

  // 开始观察卡片元素
  if (cardEl.value) {
    observer.observe(cardEl.value);
  }
}

async function initView() {
  loading.value = true
  renderChart()
}

async function renderChart() {
  renderHandler.value = useComponentRender(chartContent, props.section, 'page')
  await nextTick()
  renderHandler.value?.renderChart()
  loading.value = false
}

// 监听：主题变化
watch(skin, () => {
  renderHandler.value?.renderChart()
})

// 交互：卡片操作（切图、关闭洞察）
const sectionOperatorHandler = ({ id, section }: { id: string; section: Section | null }) => {
  if (section?.id === props.section.id) {
    switch (id) {
      case 'card_change':
        renderHandler.value?.changeChart({ pid: section.pid })
        break
      case 'close_insight':
        renderHandler.value?.closeInsight()
        break
      default:
        break
    }
  }
}

// 更新外部视图布局
function changeViewIndex(index: number) {
  renderHandler.value?.changeViewIndex(index)
}

function stopPropagation(e: MouseEvent) {
  if (renderHandler.value?.emitCustomEvent) {
    e.stopPropagation()
  }
}

defineExpose({
  initView
})
</script>
