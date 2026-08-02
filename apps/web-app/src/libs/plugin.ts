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
const _loadPlugin = (pluginId:string, src:string) => {
    const script = document.createElement('script')
    script.type = "module"
    script.src = src
    script.innerText = `import * as m from "${src}"; window.${pluginId} = m;`
    document.body.appendChild(script)
}


export const loadPlugin = (pluginId:string, src:string, timeout_ms=5000) => {
    return new Promise((resolve, reject) => {
        _loadPlugin(pluginId, src)

        const interval = 100
        let count = 0
        const intervalId = setInterval(() => {
            count += 1
            if (count > timeout_ms / interval) {
                clearInterval(intervalId);
                reject(new Error('geoUtils did not load within 3 seconds')); // 未加载则拒绝Promise
            }
            else if (pluginId in window) {
                clearInterval(intervalId);
                resolve(window.geoUtils); // 成功时解析Promise
            }
        }, interval);
    });
};

export async function dynamicImport(src: string) {
    // const module = await import(src);
    return module;
}

export const loadPlugin2 = (src:string) => {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src

        script.onload = () => {
          resolve('OK')
          script.remove()
        };

        script.onerror = () => {
          reject(new Error("Failed to load module script with URL " + src));
          script.remove();
        };

        document.documentElement.appendChild(script);
    });
};

// In dev, fetch plugin assets through the Vite proxy at /webapps/ (see
// vite.config.ts). Loading them as same-origin avoids the CORS-cross-origin
// base-URL collapse that breaks relative dynamic imports inside the loaded
// scripts. In prod, use the configured absolute base URI.
const PLUGIN_BASE = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_APP_PLUGIN_BASE_URI

// Load rust_wasm without relying on the remote bootstrap.js, which depends
// on Wasm ES Module Integration (`import * as wasm from "./x.wasm"` — not
// supported in all browsers). We instead fetch the .wasm binary ourselves
// and instantiate it with the JS bindings module as its import object,
// which is the same shape wasm-bindgen's `web` target expects.
//
// Module wire-up mirrors rust_wasm.js:
//   1. Import rust_wasm_bg.js (exports __wbg_* functions + __wbg_set_wasm)
//   2. Instantiate the wasm with { './rust_wasm_bg.js': bg } as imports
//   3. Inject wasm exports back into bg via __wbg_set_wasm
//   4. Call __wbindgen_start if present
export const loadRustWasm = async () => {
  const base = PLUGIN_BASE + '/webapps/rust_wasm/'
  const bgUrl = base + 'rust_wasm_bg.js'
  const wasmUrl = base + 'rust_wasm_bg.wasm'

  const bg = await import(/* @vite-ignore */ bgUrl) as Record<string, any>

  const imports = { './rust_wasm_bg.js': bg }
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch(wasmUrl),
    imports,
  )

  bg.__wbg_set_wasm(instance.exports)
  const start = (instance.exports as Record<string, any>).__wbindgen_start
  if (typeof start === 'function') start()

  ;(window as any).labelHelper = bg
  return bg
}

export const onnxModelApisURI = PLUGIN_BASE + '/webapps/web-onnx-yolov8/v1/onnxModelApis.json'

export const loadYoloV8Wasm = () => {
  return loadPlugin2(PLUGIN_BASE + '/webapps/web-onnx-yolov8/v1/static/js/yinghuo-onnx-web-inferencer.js')
}

export const importModule = (pluginId:string, src:string) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const tempGlobal = "__tempModuleLoadingVariable" + Math.random().toString(32).substring(2);
      script.type = "module";
      script.textContent = `import * as m from "${src}"; window.${tempGlobal} = m;`;
  
      script.onload = () => {
        resolve(window[tempGlobal]);
        delete window[tempGlobal];
        script.remove();
      };
  
      script.onerror = () => {
        reject(new Error("Failed to load module script with URL " + src));
        delete window[tempGlobal];
        script.remove();
      };
  
      document.documentElement.appendChild(script);
    });
  }