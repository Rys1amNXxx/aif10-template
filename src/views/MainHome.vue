<template>
  <div
    v-loading="loading"
    class="h-full overflow-y-auto overflow-x-hidden pb-1 w-[960px]"
  >
    <div v-show="!noData" ref="pageContainer" class="relative"></div>
    <div
      class="h-full w-[960px] translate-x-1 border-base rounded-xl after:rounded-xl flex justify-center items-center bg-white"
      v-show="noData"
    >
      暂无数据
    </div>
  </div>
</template>
<script setup lang="ts">
import 'element-plus/dist/index.css'
import '@/assets/main.less'
import { ref, createApp, nextTick, onMounted, computed, watch } from 'vue'
import { useAppInfoStore } from '@/stores/app'
import CardContainer from '@/views/CardContainer.vue'
import 'element-plus/es/components/message/style/css'
import { useDark } from '@vueuse/core'
import { mockData } from './config/mock'
const win: any = window
const { getUrlParams } = win.F10Utils

const pageContainer = ref<HTMLElement | null>(null)

const compVmArr = ref<any>([])

const loading = ref(false)

const noData = ref(false)

const appStore = useAppInfoStore()

const isDark = useDark({
  valueDark: 'dark',
  valueLight: 'light'
})

const skin = computed(() => (isDark.value ? 'dark' : 'light'))

appStore.setSkin(skin.value)
watch(skin, (val) => {
  appStore.setSkin(val)
})

const pageCreator = async (stock: string, ids: string) => {
  loading.value = true
  const section = mockData

  const res = {
    sections: [section]
  }

  // 组件实例创建 & 添加到布局
  if (res && res.sections && res.sections.length) {
    noData.value = false
    await nextTick()
    res.sections.forEach((section) => {
      const el = document.createElement('div')
      const compApp = createApp(CardContainer, { section, firstScreen: true, status: 'ready' })
      compApp.mount(el)
      compVmArr.value.push(compApp)
      pageContainer.value?.appendChild(el)
    })
    loading.value = false
    return
  }
  loading.value = false
  noData.value = true
}

onMounted(() => {
  pageCreator(getUrlParams('stock'), getUrlParams('ids'))
})
</script>
