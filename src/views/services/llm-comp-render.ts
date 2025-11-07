import type { RenderParams } from '@/common/models/component-render'
import { ref, type Ref, createApp } from 'vue'
import { useAppInfoStore } from '@/stores/app'
import { get, post } from '@/common/services/request'
import { processUrl, processParams } from '@/common/utils/params-processor'

// 扩展RenderParams接口，添加apis属性
interface ExtendedRenderParams extends RenderParams {
  apis?: Array<{
    method: string;
    isFirstScreen: boolean;
    alias: string;
    url: string;
    params: Record<string, any>;
    depends?: string[];
  }>;
}

// 获取接口数据
const getData = async (apis: Array<{
  method: string;
  isFirstScreen: boolean;
  alias: string;
  url: string;
  params: Record<string, any>;
  depends?: string[];
  returnValExample?: any;
}>) => {
  if (!apis || !Array.isArray(apis) || apis.length === 0) {
    return {};
  }
  
  const apiData: Record<string, any> = {};
  const appStore = useAppInfoStore();
  
  // 使用与render函数相同的方式获取参数
  const code = window.F10Utils.getUrlParams('code') || '300033';
  const market = window.F10Utils.getUrlParams('market') || '33';
  const codeName = appStore.stockInfo?.stock_name || '';
  
  // 基础参数
  const baseParams = { code, market, codeName };
  
  // 按顺序处理API请求
  for (const api of apis) {
    const { method, alias, url, params: apiParams, depends } = api;
    
    // 检查依赖关系
    if (depends && depends.length > 0) {
      const missingDeps = depends.filter((dep: string) => !apiData[dep]);
      if (missingDeps.length > 0) {
        console.warn(`API ${alias} 依赖 ${missingDeps.join(', ')} 数据，但数据尚未加载`);
        continue;
      }
    }
    
    try {
      if (method.toLowerCase() === 'static') {
        apiData[alias] = api.returnValExample || {};
        continue;
      }
      // 处理URL和参数
      const processedUrl = processUrl(url, baseParams, apiData);
      const processedParams = processParams(apiParams, apiData, baseParams);
      
      // 发起请求
      let response;
      console.log(processedUrl, processedParams)
      if (method.toLowerCase() === 'get') {
        response = await get({
          url: processedUrl,
          data: processedParams
        });
      } else {
        response = await post({
          url: processedUrl,
          data: processedParams
        });
      }
      
      // 存储响应数据
      if (response && response.data) {
        apiData[alias] = response.data;
      }
    } catch (error) {
      console.error(`请求 ${alias} 接口失败:`, error);
    }
  }
  
  return apiData;
};

export function useLLMCompRender() {
  const comVm: Ref<any> = ref(null)

  const render = async (dom: any, params: ExtendedRenderParams) => {
    console.log('params', params);

    const compName = params.kamisToken;
    Object.assign(params, {dom: null})

    // 动态引入组件
    const component = await import(`@/components/llm-gen/${compName}/index.vue`);
    
    // 获取配置的API数据
    const data = await getData(params.apis || []);
    // 创建组件实例并保存到comVm中
    comVm.value = createApp(component.default, { params, data });
    comVm.value.mount(dom);
  }

  const destroy = () => {
    // 销毁组件实例
    if (comVm.value) {
      comVm.value.unmount();
      comVm.value = null;
    }
  }

  return {
    render,
    destroy
  }
}