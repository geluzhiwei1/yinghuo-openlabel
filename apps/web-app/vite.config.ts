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
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import { yinghuoIconifyBundler } from './build/iconify-bundler.mjs'
import { version as pkgVersion } from './package.json'

process.env.VITE_APP_VERSION = pkgVersion


// YH_EDITION 控制入口:ce(社区版)只构建 9 个业务面;ee 加 platform/tenant_admin;
// saas 用 ee/tenant_admin.html + saas/platform.html(SaaS 专属 platform 视图)。
const EDITION = process.env.YH_EDITION ?? 'ce'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const extraInputs = EDITION === 'ce' ? {} : {
    tenantAdmin: resolve(__dirname, 'ee/tenant_admin.html'),
    platform: resolve(__dirname,
      EDITION === 'saas' ? 'saas/platform.html' : 'ee/platform.html'),
  }
  return {
    // base 硬编码,%VITE_APP_BASE_URI% 仅用于 HTML 模板内联资源引用,
    // 设为空避免 vite 再叠一层前缀(/guis/v0.3.4/guis/v0.3.4/...)
    base: '/guis/v0.3.4',
    plugins: [
      vue(),
      viteCommonjs(),
      vueJsx(),
      UnoCSS(),
      yinghuoIconifyBundler({ srcDir: resolve(__dirname, 'src') }),
    ],

    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "./src/styles/variables.module.less";',
          javascriptEnabled: true
        },
        scss: {
          api: 'modern-compiler',
          quietDeps: true,
        }
      }
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.css'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
        'three/tsl': 'three/webgpu',
      },
      // EE/SaaS 子目录是 symlink 指向外部的 git clone,默认 vite 会 follow symlink 到 clone 路径,
      // 再从那往上找 node_modules。setup-edition.sh 会在 clone 内补一个 node_modules symlink
      // 指回本仓库,让依赖解析能正常走 pnpm 的 .pnpm 结构。
    },
    build: {
      // 多页面打包配置。CE 9 个入口;EE/SaaS 11 个入口(多 platform/tenant_admin)。
      rollupOptions: {
        input: {
          auth: resolve(__dirname, 'auth.html'),
          dashboard: resolve(__dirname, 'home.html'),
          anno: resolve(__dirname, 'anno.html'),
          pc: resolve(__dirname, 'pc.html'),
          nrrd: resolve(__dirname, 'nrrd.html'),
          gaussian: resolve(__dirname, 'gaussian.html'),
          qualityDashboard: resolve(__dirname, 'dashboard.html'),
          reviewWorkbench: resolve(__dirname, 'review.html'),
          qaWorkbench: resolve(__dirname, 'qa.html'),
          ...extraInputs,
        }
      }
    },
    server: {
      port: Number(env.SERVER_PORT),
      proxy: {
        '/webapps/': {
          target: env.VITE_APP_PLUGIN_BASE_URI,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            })
          }
        },
        '/yh-web-yolo/v1.0/': {
          target: env.VITE_APP_WEBYOLO_BASE_URI,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (err) => { console.log('proxy error', err) })
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('Sending Request to the Target:', env.VITE_APP_WEBYOLO_BASE_URI, req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response from the Target:', env.VITE_APP_WEBYOLO_BASE_URI, proxyRes.statusCode, req.url)
            })
          }
        },
        // 阶段 5 联调:admin/captcha/platform 路由合并进主 app 后,
        // /api/v1/a, /api/v1/c, /api/v1/p 不再 strip 前缀(后端路由自带这些前缀);
        // 仅 /api/v1/b 仍 strip(主 app 业务路由注册在根)。
        '/api/v1/a': {
          target: env.API_URL_ADMIN,
          changeOrigin: true,
        },
        '/api/v1/b': {
          target: env.API_URL_APP,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => { console.log('proxy error', err) })
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('Sending Request to the Target:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url)
            })
          },
          rewrite: (path) => path.replace(/^\/api\/v1\/b/, '')
        },
        '/api/v1/c': {
          target: env.API_URL_CAPTCHA,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on('error', (err) => { console.log('proxy error', err) })
          },
        },
        '/api/v1/p': {
          target: env.API_URL_PLATFORM || env.API_URL_APP,
          changeOrigin: true,
        }
      },
      hmr: {
        overlay: false
      },
      host: '0.0.0.0',
    },
    optimizeDeps: {
      include: [],
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis',
        },
      },
    }
  }
})
