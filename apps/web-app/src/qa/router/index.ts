import { createRouter, createWebHashHistory } from 'vue-router'
import { userAuth } from '@/states/UserState'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/workbench',
    },
    {
      path: '/workbench',
      name: 'qa-workbench',
      meta: { title: '终检工作台', requireAuth: true },
      component: () => import('../views/QaWorkbench.vue'),
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
