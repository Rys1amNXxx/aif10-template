import MainBusiness from '@/components/llm-gen/MainBusiness/config.json'
import GenModule from '@/components/llm-gen/GenModule/config.json'
import FinancialMineChart from '@/components/llm-gen/FinancialMineChart/config.json'
import KlineDemo from '@/components/llm-gen/KlineDemo/config.json'

// KlineDemo 组件的标注配置 - 使用相对日期以便在实际数据中找到匹配点
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const klineAnnotations = [
    {
        type: 'tag',
        timestamp: now - 120 * dayMs, // 120天前
        text: '预案发布',
        style: 'primary',
    },
    {
        type: 'tag',
        timestamp: now - 80 * dayMs, // 80天前
        text: '股东大会',
        style: 'success',
    },
    {
        type: 'tag',
        timestamp: now - 50 * dayMs, // 50天前
        text: '首次进展',
        subText: '10.00%',
        style: 'success',
    },
    {
        type: 'tag',
        timestamp: now - 20 * dayMs, // 20天前
        text: '回购期限调整',
        subText: '2025/09/01→2025/09/13',
        style: 'primary',
    },
]

const klineRegions = [
    {
        startTimestamp: now - 60 * dayMs,
        endTimestamp: now - 30 * dayMs,
        text: '最新回购价格区间',
        color: 'rgba(33, 150, 243, 0.08)',
    },
]

export const mockData = {
    "id": "debug",
    "gid": null,
    "pid": null,
    "index": -1,
    "value": null,
    "title": "回购开始",
    "subtitle": null,
    "type": null,
    "visual_index": -1,
    "view_index": -1,
    "chart_ids": [],
    "extension": {
        "fullWidth": true
    },
    "index_meta": [],
    "stock_meta": [],
    "default_stock_meta": [],
    "view_wrapper": {
        "index": -1,
        "views": [
            {
                "name": "llm-gen2",
                "type": "fix_chart",
                "fix_module_id": null,
                "chart_ids": [],
                "visual": {
                    "input": {
                        "data_type": "Tabular",
                        "attribute_description": []
                    },
                    "data": [],
                    "features": [],
                    "output": [
                        {
                            "name": "MainBusiness",
                            "type": "llmgen",
                            "parameter": [
                                { "name": "stockCode", "value": "300033" },
                                { "name": "stockMarket", "value": "33" },
                                { "name": "title", "value": "回购开始" },
                                { "name": "annotations", "value": klineAnnotations },
                                { "name": "regions", "value": klineRegions },
                                { "name": "showDataZoom", "value": true }
                            ],
                            "style": {},
                            "extension": MainBusiness
                        }
                    ],
                    "index": -1
                },
                "extension": {},
                "features": {}
            }
        ],
        "empty": false
    },
    "from": null,
    "kline": true
}