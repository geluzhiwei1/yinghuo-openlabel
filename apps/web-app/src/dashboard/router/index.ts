import { createRouter, createWebHashHistory } from 'vue-router'
import { userAuth } from '@/states/UserState'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/overview',
    },
    {
      path: '/overview',
      name: 'overview',
      meta: { title: '总览', requireAuth: true },
      component: () => import('../views/OverviewView.vue'),
    },
    {
      path: '/by-assignee',
      name: 'by-assignee',
      meta: { title: '标注员统计', requireAuth: true },
      component: () => import('../views/ByAssignee.vue'),
    },
    {
      path: '/by-reviewer',
      name: 'by-reviewer',
      meta: { title: '审核员统计', requireAuth: true },
      component: () => import('../views/ByReviewer.vue'),
    },
    {
      path: '/reject-categories',
      name: 'reject-categories',
      meta: { title: '驳回类别', requireAuth: true },
      component: () => import('../views/RejectCategories.vue'),
    },
    {
      // Stage 10.4: stage 级耗时分析
      path: '/stage-performance',
      name: 'stage-performance',
      meta: { title: 'stage 性能', requireAuth: true },
      component: () => import('../views/StagePerformance.vue'),
    },
  ],
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requireAuth && !userAuth.value.isLogin) {
    window.location.href = `${import.meta.env.BASE_URL}/auth.html`
    return
  }
  if (typeof to.meta.title === 'string') {
    document.title = `萤火 · ${to.meta.title}`
  }
  next()
})

export default router
