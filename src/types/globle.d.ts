export { }

interface UserInfo {
  // 头像
  avatar: string;
  // 昵称
  uname: string;
  // 用户id
  userid: string;
}

declare global {
  interface Window {
    AIGCDataVis: {
      render(dom: HTMLElement, spec: Specification);
      destroy(dom: HTMLElement);
      presetHook: any;
      presetThemeBuilder(skin: string): any;
    },
    F10Utils: {
      getUrlParams(key: string): string;
      getFormatYAxis(value: number);
    },
    loginIssue: {
      isLogin(): boolean;
      getUser(): UserInfo;
      logOut(url: string);
    },
    weblog: {
      setConfig(config: { debug: boolean, appKey: string, logPrefix: string });
      report(param: { id: string, action: string, logmap: any });
    };
    ThsDataVStandardChart: {
      echarts: any
    },
    f10log(category: string, content: string, err: any): void;
    introJs: any;
  }
}
