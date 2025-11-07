// 递归获取嵌套对象的值
export const getNestedValue = (obj: any, path: string): any => {
  if (!obj) return undefined;
  
  // 将路径分割成访问序列
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    
    // 如果part是数字，说明是数组索引
    const index = parseInt(part);
    if (!isNaN(index)) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = current[part];
    }
  }
  
  return current;
};

// 基础参数接口
interface BaseParams {
  code: string;
  market: string;
  codeName: string;
  [key: string]: any;
}

// 获取基础参数
export const getBaseParams = (): BaseParams => {
  const code = window.F10Utils.getUrlParams('code') || '300033';
  const market = window.F10Utils.getUrlParams('market') || '33';
  const codeName = window.F10Utils.getUrlParams('codeName') || '';
  return { code, market, codeName };
};

// 处理URL参数替换
export const processUrl = (url: string, params: Record<string, any> = {}, apiData?: Record<string, any>) => {
  let processedUrl = url;
  const baseParams = getBaseParams();
  const allParams = { ...baseParams, ...params };
  
  // 替换URL中的变量，如 ${code} 等
  Object.keys(allParams).forEach(key => {
    const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    processedUrl = processedUrl.replace(pattern, String(allParams[key]));
  });
  return processedUrl;
};

// 处理参数替换，包括依赖关系
export const processParams = (apiParams: Record<string, any>, apiData?: Record<string, any>, baseParams?: Partial<BaseParams>) => {
  const result: Record<string, any> = {};
  const defaultBaseParams = getBaseParams();
  const finalBaseParams = { ...defaultBaseParams, ...baseParams };
  
  Object.entries(apiParams).forEach(([key, value]) => {
    // 如果是数组，保持数组结构
    if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (typeof item === 'string' && item.includes('${')) {
          const matches = item.match(/\$\{([^}]+)\}/g);
          if (matches) {
            let processedValue = item;
            matches.forEach(match => {
              const paramKey = match.slice(2, -1);
              
              // 尝试从基础参数中获取值
              const baseValue = getNestedValue(finalBaseParams, paramKey);
              if (baseValue !== undefined) {
                processedValue = processedValue.replace(match, String(baseValue));
                return;
              }
              
              // 尝试从API数据中获取值
              if (apiData) {
                const apiValue = getNestedValue(apiData, paramKey);
                if (apiValue !== undefined) {
                  processedValue = processedValue.replace(match, String(apiValue));
                }
              }
            });
            return processedValue;
          }
        }
        return item;
      });
    } else if (typeof value === 'string' && value.includes('${')) {
      // 处理依赖参数替换
      const matches = value.match(/\$\{([^}]+)\}/g);
      if (matches) {
        let processedValue = value;
        matches.forEach(match => {
          const paramKey = match.slice(2, -1); // 去掉${}
          
          // 尝试从基础参数中获取值
          const baseValue = getNestedValue(finalBaseParams, paramKey);
          if (baseValue !== undefined) {
            processedValue = processedValue.replace(match, String(baseValue));
            return;
          }
          
          // 尝试从API数据中获取值
          if (apiData) {
            const apiValue = getNestedValue(apiData, paramKey);
            if (apiValue !== undefined) {
              processedValue = processedValue.replace(match, String(apiValue));
            }
          }
        });
        result[key] = processedValue;
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = processParams(value, apiData, finalBaseParams);
    } else {
      result[key] = value;
    }
  });
  
  return result;
}; 