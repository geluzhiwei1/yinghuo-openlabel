import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/home.vue';
import { userAuth } from '@/states/UserState'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/403',
      name: 'ForbiddenAccess',
      component: () => import('../views/pages/403.vue')
    },
    {
      path: '/',
      name: 'Home',
      component: Home,
      redirect: "/dashboard-v2",
      children: [
        {
          path: '/annojob-v2',
          name: 'annojob-v2',
          meta: {
            title: '标注任务',
            // role: 'annojob',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "annojob" */ '../views/system/AnnoJob/anno-job-v2.vue'),
        },
        {
          path: '/dashboard-v2',
          name: 'dashboard-v2',
          meta: {
            title: '首页',
            // role: 'dashboard',
            requireAuth: true,
            closable: false
          },
          component: () => import(/* webpackChunkName: "dashboard" */ '../views/dashboard-v2.vue'),
        },
        {
          path: '/system-dept',
          name: 'system-dept',
          meta: {
            title: '部门管理',
            // role: 'system-dept',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "system-dept" */ '../views/system/dept.vue'),
        },
        {
          path: '/system-role',
          name: 'system-role',
          meta: {
            title: '角色管理',
            // role: 'system-role',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "system-role" */ '../views/system/role.vue'),
        },
        {
          path: '/system-data',
          name: 'system-data',
          meta: {
            title: '我的数据',
            // role: 'system-data',
            requireAuth: true,
            closable: true,
          },
          component: () => import('../views/system/datas.vue'),
        },
        {
          path: '/system-menu',
          name: 'system-menu',
          meta: {
            title: '菜单管理',
            // role: 'system-menu',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "system-menu" */ '../views/system/menu.vue'),
        },
        {
          path: '/anno-specification',
          name: 'anno-specification',
          meta: {
            title: '标注规范',
            // role: 'anno-specification',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "anno-specification" */ '../views/system/anno-spec.vue')
        },
        {
          path: '/other-group',
          name: 'other-group',
          meta: {
            title: '我参加的',
            // role: 'other-group',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "anno-specification" */ '../views/team/other-group.vue')
        },
        {
          path: '/my-group',
          name: 'my-group',
          meta: {
            title: '我的团队',
            // role: 'my-group',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "anno-specification" */ '../views/team/my-group.vue')
        },
        {
          path: '/my-job',
          name: 'my-job',
          meta: {
            title: '我的任务',
            requireAuth: true,
            // role: 'my-job',
            closable: true,
          },
          component: () => import(/* webpackChunkName: "my-job" */ '../views/system/AnnoJob/my-job.vue'),
        },
        {
          path: '/user-info',
          name: 'user-info',
          meta: {
            title: '我的信息',
            // role: 'user-info',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "user-info" */ '../views/system/user-info.vue'),
        },
        {
          path: '/data-package-manager',
          name: 'data-package-manager',
          meta: {
            title: '数据包管理',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "data-package-manager" */ '../views/dataPackageManager/index.vue'),
        },
        {
          path: '/label-batch',
          name: 'label-batch',
          meta: {
            title: '标注批次',
            // role: 'label-batch',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "label-batch" */ '../views/labelBatch/index.vue'),
        },
        {
          // Stage 9.6: workflow 驱动的批次管理
          path: '/batches',
          name: 'batches-list',
          meta: {
            title: '批次管理',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "batches" */ '../views/batches/BatchList.vue'),
        },
        {
          path: '/batches/create',
          name: 'batches-create',
          meta: {
            title: '新建批次',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "batches" */ '../views/batches/BatchCreate.vue'),
        },
        {
          path: '/batches/:id',
          name: 'batches-detail',
          meta: {
            title: '批次详情',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "batches" */ '../views/batches/BatchDetail.vue'),
        },
        {
          // Stage 10.2: 工作流运行态监控
          path: '/workflow-monitor',
          name: 'workflow-monitor',
          meta: {
            title: '工作流监控',
            requireAuth: true,
            closable: true,
          },
          component: () => import(/* webpackChunkName: "workflow-monitor" */ '../views/workflow-monitor/MonitorOverview.vue'),
        },
      ],
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
  ]
})


// const modulePath = '/home.html';
router.beforeEach((to, from, next) => {
  if (to.meta.requireAuth) {
    if (userAuth.value.isLogin) {
      if (to.meta.role) {
        if (userAuth.value.roles.includes(to.meta.role)) {
          next()
        } else {
          next('/403')
        }
      } else {
        next()
      }
    } else {
      // 如果用户未登录
      window.location.href = `${import.meta.env.BASE_URL}/auth.html`
    }
  } else {
    next()
  }
})


export default router
