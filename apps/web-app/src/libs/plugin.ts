/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年7月8日 16:18:06
 * @date 甲辰 [龙] 年 六月初三
 */

/**
 * 加载并执行 JavaScript 脚本
 *
 * @param pluginId 模块ID，用于标识加载的脚本
 * @param src 脚本的 URL
 */
const _loadPlugin = (pluginId: string, src: string) => {
  const script = document.createElement('script')
  script.type = 'module'
  script.src = src
  script.innerText = `import * as m from "${src}"; window.${pluginId} = m;`
  document.body.appendChild(script)
}

export const loadPlugin = (pluginId: string, src: string, timeout_ms = 5000) => {
  return new Promise((resolve, reject) => {
    _loadPlugin(pluginId, src)

    const interval = 100
    let count = 0
    const intervalId = setInterval(() => {
      count += 1
      if (count > timeout_ms / interval) {
        clearInterval(intervalId)
        reject(new Error('geoUtils did not load within 3 seconds')) // 未加载则拒绝Promise
      } else if (pluginId in window) {
        clearInterval(intervalId)
        resolve((window as any).geoUtils) // 成功时解析Promise
      }
    }, interval)
  })
}

export async function dynamicImport(src: string) {
  // const module = await import(src);
  // return module
}

export const loadPlugin2 = (src: string) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src

    script.onload = () => {
      resolve('OK')
      script.remove()
    }

    script.onerror = () => {
      reject(new Error('Failed to load module script with URL ' + src))
      script.remove()
    }

    document.documentElement.appendChild(script)
  })
}

export const loadRustWasm = () => {
  return loadPlugin2(import.meta.env.VITE_APP_PLUGIN_BASE_URI + '/webapps/rust_wasm/bootstrap.js')
}

// yolo v8 wasm
export const webYoloApisConf = import.meta.env.VITE_APP_WEBYOLO_BASE_URI + '/yh-web-yolo/v1.0/onnxModelApis.json'
export const webYoloJsLib = import.meta.env.VITE_APP_WEBYOLO_BASE_URI + '/yh-web-yolo/v1.0/YHWebYolo.js'

export const loadYoloV8Wasm = () => {
  // 如果当前是在开发环境，则加载本地文件
  if (import.meta.env.PROD) {
    ; // TODO
  } else {
    Promise.all([loadPlugin2("https://s4.zstatic.net/ajax/libs/onnxruntime-web/1.17.3/ort.min.js")])
    return loadPlugin2(webYoloJsLib)
  }
}

export const importModule = (pluginId: string, src: string) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const tempGlobal = '__tempModuleLoadingVariable' + Math.random().toString(32).substring(2)
    script.type = 'module'
    script.textContent = `import * as m from "${src}"; window.${tempGlobal} = m;`

    script.onload = () => {
      resolve((window as any)[tempGlobal])
      delete (window as any)[tempGlobal]
      script.remove()
    }

    script.onerror = () => {
      reject(new Error('Failed to load module script with URL ' + src))
      delete (window as any)[tempGlobal]
      script.remove()
    }

    document.documentElement.appendChild(script)
  })
}
