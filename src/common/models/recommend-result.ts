export interface Stock{seq:string;stock_code:string;market_id:string;stock_name:string;sec_id:string;org_id:string;stock_name_ping_yin:string;exchange_name:string;exchange_code:string;listed_status_name:string;listed_status_code:string;ths_code:string;market_code:string;image_url:string}
export interface IndexInfo{name:string;index_id:string;unit:string}
type ViewType='fix'|'prompt'|'fix_chart'|'fix_prompt'|'lowcode';
export interface ParseStep{msg:string;name:QueryStatus;status:string}
export interface AttributeDescription{attribute_type:'STR'|'DOUBLE'|'DATE';attribute_unit:string|null;attribute_name:string}
export interface InputData{attribute_description:AttributeDescription[];data_type:string}
export interface Layer{type:string;encoding:any;maxHeight?:number;width?:number;stocks:Stock[];customEvent:any}
export interface OutDataItem{name:string;parameter:Layer[];type:string;extension:any;style:any}
export interface Visual{index:number;data:any;input:InputData;output:OutDataItem[]}
export interface View{chart_ids:string[];extension:any;fix_module_id:string;name:string;type:ViewType;visual:Visual}
export interface Section{chart_ids:string[];default_stock_meta:Stock[];extension:any;gid:string;id:string;index:number;index_meta:IndexInfo[];pid:string;stock_meta:Stock[];subtitle:string;title:string;value:string;kline:boolean;view_wrapper:{index:number;views:View[]};visual_index:number;view_index:number;active?:boolean;hover?:boolean;from?:string}
export interface Group{id:string;index:number;pid:string;reason:string;sections:Section[];title:string}
export interface Panel{id:string;groups:Group[];query:string;stock_meta:Stock[]}
export interface PanelV2{id:string;section_tasks:AIF10Section[];query:string;page_stock_meta:Stock}
export interface SectionAnalyze{content:string;dataset_features:any[];id:string;pid:string;sid:string}
export type QueryStatus='error'|'running'|'init'|'ready';
export interface RecommendResult{id:string;status:QueryStatus;step:ParseStep;step_history:ParseStep[];uid:string|null;valid:number;version:number}
export interface PanelCreate{id:string;query:string;resource:string;status:string}
export interface SectionCreate{id:string;query:string;resource:string;status:string}
export interface AIF10Panel extends RecommendResult{result:Panel}
export interface AIF10PanelV2 extends RecommendResult{result:PanelV2}
export interface AIF10Section extends RecommendResult{result:Section}
export interface AIF10SectionAnalyze extends RecommendResult{result:SectionAnalyze}