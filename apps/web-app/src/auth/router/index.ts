import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/login-v2',
    },
    {
        path: '/login',
        redirect: '/login-v2',
    },
    {
        path: '/login-v2',
        meta: {
            title: '登录',
            noAuth: true,
        },
        component: () => import(/* webpackChunkName: "login-v2" */ '../views/pages/login-v2.vue'),
    },
    {
        path: '/register',
        redirect: '/register-v2',
    },
    {
        path: '/register-v2',
        meta: {
            title: '注册',
            noAuth: true,
        },
        component: () => import(/* webpackChunkName: "register-v2" */ '../views/pages/register-v2.vue'),
    },
    {
        path: '/reset-pwd',
        redirect: '/reset-pwd-v2',
    },
    {
        path: '/reset-pwd-v2',
        meta: {
            title: '重置密码',
            noAuth: true,
        },
        component: () => import(/* webpackChunkName: "reset-pwd-v2" */ '../views/pages/resetpwd-v2.vue'),
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;
