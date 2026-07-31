<template>
  <div class="y-gs-datapanel">
    <div class="y-gs-datapanel__bar">
      <Icon icon="lucide:database" :width="14" />
      <span>数据 · DATA</span>
    </div>

    <div class="y-gs-datapanel__body">
      <section class="y-gs-section">
        <button class="y-gs-import" @click="pickFile" :disabled="gaussianState.loading">
          <Icon icon="lucide:upload-cloud" :width="16" />
          <span>{{ gaussianState.loading ? '解析中…' : '导入高斯泼溅文件' }}</span>
        </button>
        <p class="y-gs-section__hint">
          支持 .ply (3DGS) / .splat / .spz —— 文件仅在浏览器本地解析，不会上传服务器。
        </p>

        <div v-if="gaussianState.lastError" class="y-gs-error">
          <Icon icon="lucide:triangle-alert" :width="14" />
          <span>{{ gaussianState.lastError }}</span>
        </div>
      </section>

      <section v-if="gaussianState.loaded" class="y-gs-section">
        <div class="y-gs-section__title">当前帧</div>
        <dl class="y-gs-kv">
          <dt>文件名</dt>
          <dd :title="gaussianState.fileName">{{ gaussianState.fileName }}</dd>
          <dt>格式</dt>
          <dd><span class="y-gs-tag">{{ formatLabel }}</span></dd>
          <dt>粒子数</dt>
          <dd class="y-gs-num">{{ gaussianState.count.toLocaleString() }}</dd>
        </dl>
        <div v-if="gaussianState.isPointCloud" class="y-gs-info">
          <Icon icon="lucide:info" :width="14" />
          <span>该 PLY 不含 3DGS 字段 (f_dc_*),已按点云解析 —— splat 尺寸由点密度估算,旋转/不透明度为合成值。</span>
        </div>
      </section>

      <section v-if="gaussianState.bounds" class="y-gs-section">
        <div class="y-gs-section__title">包围盒</div>
        <table class="y-gs-bounds">
          <thead>
            <tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>
          </thead>
          <tbody>
            <tr>
              <td class="y-gs-bounds__label">min</td>
              <td>{{ fmt(gaussianState.bounds.min[0]) }}</td>
              <td>{{ fmt(gaussianState.bounds.min[1]) }}</td>
              <td>{{ fmt(gaussianState.bounds.min[2]) }}</td>
            </tr>
            <tr>
              <td class="y-gs-bounds__label">max</td>
              <td>{{ fmt(gaussianState.bounds.max[0]) }}</td>
              <td>{{ fmt(gaussianState.bounds.max[1]) }}</td>
              <td>{{ fmt(gaussianState.bounds.max[2]) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="gaussianState.loaded" class="y-gs-section">
        <div class="y-gs-section__title">编辑</div>
        <div class="y-gs-row">
          <el-button size="small" @click="exportMeta">
            <Icon icon="lucide:download" :width="14" /> 导出元数据 (JSON)
          </el-button>
          <el-button size="small" @click="clearAll" plain>
            <Icon icon="lucide:trash-2" :width="14" /> 清空
          </el-button>
        </div>
        <p class="y-gs-section__hint" v-if="gaussianState.labels.length > 0 || gaussianState.hidden.size > 0">
          导出包含 <span class="y-gs-num">{{ gaussianState.labels.length }}</span> 个标签、
          <span class="y-gs-num">{{ gaussianState.hidden.size.toLocaleString() }}</span> 个隐藏索引。
        </p>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { fileOpen } from 'browser-fs-access'
import { gaussianState, resetGaussianState } from '../state'
import { loadSplatFile } from '../render/loaders'
import { eventBus } from '../event/EventBus'
import { exportMeta } from '../export-meta'

const formatLabel = computed(() => {
  const f = gaussianState.format.toUpperCase()
  return gaussianState.isPointCloud ? `${f} · 点云` : f
})

const pickFile = async () => {
  gaussianState.loading = true
  gaussianState.lastError = ''
  try {
    const file = await fileOpen({
      description: 'Gaussian Splatting files',
      extensions: ['.ply', '.splat', '.spz'],
      multiple: false,
    }) as File

    const result = await loadSplatFile(file, file.name)
    resetGaussianState()
    gaussianState.splats = result.data
    gaussianState.count = result.data.count
    gaussianState.fileName = result.fileName
    gaussianState.format = result.format
    gaussianState.isPointCloud = result.isPointCloud
    gaussianState.loaded = true
    gaussianState.loading = false

    eventBus.emit('splat:loaded', {
      count: result.data.count,
      format: result.format,
      fileName: result.fileName,
    })
    ElMessage.success(`已加载 ${result.data.count.toLocaleString()} 个 splat (${result.format.toUpperCase()})`)
  } catch (e: any) {
    gaussianState.loading = false
    if (e?.name === 'AbortError') return
    const msg = e?.message || '加载失败'
    gaussianState.lastError = msg
    eventBus.emit('splat:error', { message: msg })
    ElMessage.error(msg)
  }
}

const clearAll = () => {
  resetGaussianState()
  eventBus.emit('splat:cleared')
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : '—')

onMounted(() => {
  eventBus.on('request-import', pickFile)
})
onBeforeUnmount(() => {
  eventBus.off('request-import', pickFile)
})
</script>

<style scoped lang="scss">
.y-gs-datapanel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--y-color-bg-card, #fbfaf5);
  font-size: 12px;
}

.y-gs-datapanel__bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 32px;
  border-bottom: 1px solid var(--y-color-divider, #e6e4dc);
  color: var(--y-color-text-secondary, #3f4046);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.y-gs-datapanel__body {
  flex: 1;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.y-gs-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.y-gs-section__title {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--y-color-text-placeholder, #8a8b92);
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
}

.y-gs-section__hint {
  font-size: 11px;
  color: var(--y-color-text-placeholder, #8a8b92);
  line-height: 1.5;
  margin: 0;
}

.y-gs-import {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 999px;
  background: var(--lab-ink, #0e0e10);
  color: var(--lab-snow, #ffffff);
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: opacity 150ms ease;

  &:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  &:not(:disabled):hover {
    opacity: 0.85;
  }
}

.y-gs-error {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(255, 106, 61, 0.1);
  color: #c0503e;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.5;
}

.y-gs-info {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(28, 121, 255, 0.08);
  color: #2a5db8;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.5;
}

.y-gs-kv {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 6px 12px;
  margin: 0;

  dt {
    color: var(--y-color-text-placeholder, #8a8b92);
    font-size: 11px;
  }
  dd {
    margin: 0;
    color: var(--y-color-text-primary, #0e0e10);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
    font-size: 11.5px;
  }
}

.y-gs-num {
  letter-spacing: 0.02em;
}

.y-gs-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--lab-coral, #ff6a3d);
  color: var(--lab-snow, #ffffff);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.y-gs-bounds {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--y-font-family-mono, "JetBrains Mono", monospace);
  font-size: 11px;

  th {
    text-align: right;
    color: var(--y-color-text-placeholder, #8a8b92);
    font-weight: 500;
    padding: 4px 6px;
    border-bottom: 1px solid var(--y-color-divider, #e6e4dc);
  }
  td {
    text-align: right;
    padding: 3px 6px;
    color: var(--y-color-text-primary, #0e0e10);
  }
  td.y-gs-bounds__label {
    text-align: left;
    color: var(--y-color-text-placeholder, #8a8b92);
  }
}

.y-gs-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
