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
import { version as pkgVersion } from './package.json'

process.env.VITE_APP_VERSION = pkgVersion

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_APP_BASE_URI,
    plugins: [vue(), viteCommonjs(), vueJsx(), UnoCSS()],

    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "./src/styles/variables.module.less";',
          javascriptEnabled: true
        }
      }
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.css'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
        'three/tsl': 'three/webgpu'
      }
    },
    build: {
      rollupOptions: {
        input: {
          login: resolve(__dirname, 'login.html'),
          dashboard: resolve(__dirname, 'home.html'),
          anno: resolve(__dirname, 'anno.html'),
        }
      }
    },
    server: {
      port: Number(env.SERVER_PORT),
      proxy: {
        '/webapps/': {
          target: env.VITE_APP_PLUGIN_BASE_URI,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            })
          }
        },
        '/yh-web-yolo/v1.0/': {
          target: env.VITE_APP_WEBYOLO_BASE_URI,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', env.VITE_APP_WEBYOLO_BASE_URI,req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', env.VITE_APP_WEBYOLO_BASE_URI, proxyRes.statusCode, req.url)
            })
          }
        },
        '/api/v1/a': {
          target: env.API_URL_ADMIN,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/a/, '')
        },
        '/api/v1/b': {
          target: env.API_URL_APP,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
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
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url)
            })
          },
          rewrite: (path) => path.replace(/^\/api\/v1\/c/, '')
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
          global: 'globalThis'
        }
      }
    }
  }
})
