import GenModule from '@/components/llm-gen/GenModule/config.json'

export const mockData = {
    "id": "debug",
    "gid": null,
    "pid": null,
    "index": -1,
    "value": null,
    "title": "演示模块",
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
                            "name": "GenModule",
                            "type": "llmgen",
                            "parameter": [
                                {
                                    "type": "bar",
                                    "encoding": {
                                        "x": "变动日期",
                                        "y": "股东总户数"
                                    }
                                },
                                {
                                    "type": "line",
                                    "encoding": {
                                        "x": "变动日期",
                                        "y": "收盘价(元)"
                                    }
                                }
                            ],
                            "style": {
                                "yAxis": {
                                    "type": "value",
                                    "boundaryGap": [
                                        0,
                                        "20%"
                                    ]
                                },
                                "label": {
                                    "show": true,
                                    "position": "top"
                                }
                            },
                            "extension": GenModule
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