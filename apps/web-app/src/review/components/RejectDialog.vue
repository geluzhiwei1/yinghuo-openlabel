<template>
  <el-dialog
    v-model="visible"
    title="驳回当前 Unit"
    width="520"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80" size="default">
      <el-form-item label="类别" prop="category">
        <el-select
          v-model="form.category"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入驳回类别"
          style="width: 100%"
        >
          <el-option
            v-for="cat in commonCategories"
            :key="cat"
            :label="cat"
            :value="cat"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="严重度" prop="severity">
        <el-radio-group v-model="form.severity">
          <el-radio-button value="critical">致命</el-radio-button>
          <el-radio-button value="major">严重</el-radio-button>
          <el-radio-button value="minor">轻微</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="说明" prop="note">
        <el-input
          v-model="form.note"
          type="textarea"
          :rows="4"
          placeholder="给标注员的具体反馈"
          maxlength="512"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button
          type="danger"
          :loading="submitting"
          @click="onSubmit"
        >
          确认驳回
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'

interface RejectPayload {
  category: string
  severity: string
  note?: string
}

const props = defineProps<{
  modelValue: boolean
  submitting?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'submit', payload: RejectPayload): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const formRef = ref<FormInstance | null>(null)
const form = reactive<RejectPayload>({
  category: '',
  severity: 'major',
  note: '',
})

const rules: FormRules = {
  category: [{ required: true, message: '请选择或输入类别', trigger: 'change' }],
  severity: [{ required: true, message: '请选择严重度', trigger: 'change' }],
}

const commonCategories = [
  '漏标',
  '错标',
  '类别错误',
  '位置不准',
  '尺寸偏差',
  '属性错误',
  '冗余标注',
  '其它',
]

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      form.category = ''
      form.severity = 'major'
      form.note = ''
    }
  },
)

const onClosed = () => {
  formRef.value?.clearValidate()
}

const onSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!form.category.trim()) {
    ElMessage.warning('请填写类别')
    return
  }
  emit('submit', {
    category: form.category.trim(),
    severity: form.severity,
    note: form.note?.trim() || undefined,
  })
}
</script>
