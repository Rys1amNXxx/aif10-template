import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import pkg from './package.json'

// // https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  console.log(command);
  return {
    base: command === 'serve' ? './' : '//s.thsi.cn/cd/website-f10-pluto/v3.7.5/',
    logLevel: 'info', // 增加详细日志
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
    },
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      host: '0.0.0.0',
      port: 9999,
      proxy: {
        "/basicapi": {
          target: "http://data.10jqka.com.cn/",
          changeOrigin: true,
        },
        "/spider": {
          target: "http://cbasspider.10jqka.com.cn:8443/",
          changeOrigin: true,
        },
        "/vote": {
          target: "http://basic.10jqka.com.cn/",
          changeOrigin: true,
        },
        "/aif10": {
          target: "http://data.10jqka.com.cn/",
          changeOrigin: true,
        }
      },
    },
  }
})
