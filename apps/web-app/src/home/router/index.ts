/*
Copyright (C) 2025 undefined

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/home.vue'
import { userAuth } from '@/states/UserState'
import { i18n } from '@/locales'

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
      redirect: '/dashboard',
      children: [
        {
          path: '/annojob',
          name: 'annojob',
          meta: {
            title: 'home.menu.annojob',
            // role: 'annojob',
            requireAuth: true,
            closable: true
          },
          component: () =>
            import(/* webpackChunkName: "annojob" */ '../views/system/AnnoJob/anno-job.vue')
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          meta: {
            title: 'home.menu.dashboard',
            // role: 'dashboard',
            requireAuth: true,
            closable: false
          },
          component: () => import(/* webpackChunkName: "dashboard" */ '../views/dashboard.vue')
        },
        {
          path: '/system-dept',
          name: 'system-dept',
          meta: {
            title: 'home.menu.system-dept',
            // role: 'system-dept',
            requireAuth: true,
            closable: true
          },
          component: () => import(/* webpackChunkName: "system-dept" */ '../views/system/dept.vue')
        },
        {
          path: '/system-role',
          name: 'system-role',
          meta: {
            title: 'home.menu.system-role',
            // role: 'system-role',
            requireAuth: true,
            closable: true
          },
          component: () => import(/* webpackChunkName: "system-role" */ '../views/system/role.vue')
        },
        {
          path: '/system-data',
          name: 'system-data',
          meta: {
            title: 'home.menu.system-data',
            // role: 'system-data',
            requireAuth: true,
            closable: true
          },
          component: () => import('../views/system/datas.vue')
        },
        {
          path: '/system-menu',
          name: 'system-menu',
          meta: {
            title: 'home.menu.system-menu',
            // role: 'system-menu',
            requireAuth: true,
            closable: true
          },
          component: () => import(/* webpackChunkName: "system-menu" */ '../views/system/menu.vue')
        },
        {
          path: '/anno-specification',
          name: 'anno-specification',
          meta: {
            title: 'home.menu.anno-specification',
            // role: 'anno-specification',
            requireAuth: true,
            closable: true
          },
          component: () =>
            import(/* webpackChunkName: "anno-specification" */ '../views/system/anno-spec.vue')
        },
        {
          path: '/my-job',
          name: 'my-job',
          meta: {
            title: 'home.menu.my-job',
            requireAuth: true,
            // role: 'my-job',
            closable: true
          },
          component: () =>
            import(/* webpackChunkName: "my-job" */ '../views/system/AnnoJob/my-job.vue')
        },
        {
          path: '/user-info',
          name: 'user-info',
          meta: {
            title: 'home.menu.user-info',
            // role: 'user-info',
            requireAuth: true,
            closable: true
          },
          component: () =>
            import(/* webpackChunkName: "user-info" */ '../views/system/user-info.vue')
        },
        {
          path: '/data-package-manager',
          name: 'data-package-manager',
          meta: {
            title: 'home.menu.data-package-manager',
            requireAuth: true,
            closable: true
          },
          component: () =>
            import(
              /* webpackChunkName: "data-package-manager" */ '../views/dataPackageManager/index.vue'
            )
        },
        {
          path: '/label-batch',
          name: 'label-batch',
          meta: {
            title: 'home.menu.label-batch',
            // role: 'label-batch',
            requireAuth: true,
            closable: true
          },
          component: () =>
            import(/* webpackChunkName: "label-batch" */ '../views/labelBatch/index.vue')
        }
      ]
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    }
  ]
})

// const modulePath = '/home.html';
router.beforeEach((to, from, next) => {
  if (to.meta.requireAuth) {
    if (userAuth.value.isLogin) {
      if (to.meta.role) {
        if (
          typeof to.meta.role === 'string' &&
          userAuth.value.roles.includes(to.meta.role)
        ) {
          next()
        } else {
          next('/403')
        }
      } else {
        next()
      }
    } else {
      // 如果用户未登录
      window.location.href = `${import.meta.env.BASE_URL}/login.html`
    }
  } else {
    next()
  }
})

export default router
