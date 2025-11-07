import { createRouter, createWebHashHistory } from 'vue-router'
import MainHome from './MainHome.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MainHome,
    }
  ]
})

// 添加全局前置守卫
router.beforeEach(async (to, from, next) => {
  if (to.path === '/' && Object.keys(to.query).length === 0) {
    next({
      path: '/',
      query: {
        stock: '300033',
        ids: 'llm-gen2',
        dev: '1',
      }
    })
  } else {
    next()
  }
})

export default router
