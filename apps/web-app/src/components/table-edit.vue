<template>
  <el-form ref="formRef" :model="form" :rules="rules" :label-width="options.labelWidth">
    <el-row>
      <el-col :span="options.span" v-for="item in options.list" :key="item.prop">
        <el-form-item :label="item.label" :prop="item.prop">
          <!-- 文本框、数字框、下拉框、日期框、开关、上传 -->
          <el-input
            v-if="item.type === 'input'"
            v-model="form[item.prop]"
            :disabled="item.disabled"
            :placeholder="item.placeholder"
            clearable
          ></el-input>
          <el-input-number
            v-else-if="item.type === 'number'"
            v-model="form[item.prop]"
            :disabled="item.disabled"
            controls-position="right"
          ></el-input-number>
          <el-select
            v-else-if="item.type === 'select'"
            v-model="form[item.prop]"
            :disabled="item.disabled"
            :placeholder="item.placeholder"
            clearable
          >
            <el-option
              v-for="opt in item.opts"
              :label="opt.label"
              :value="opt.value"
              :key="opt.label"
            ></el-option>
          </el-select>
          <el-date-picker
            v-else-if="item.type === 'date'"
            type="date"
            v-model="form[item.prop]"
            :value-format="item.format"
          ></el-date-picker>
          <el-switch
            v-else-if="item.type === 'switch'"
            v-model="form[item.prop]"
            :active-value="item.activeValue"
            :inactive-value="item.inactiveValue"
            :active-text="item.activeText"
            :inactive-text="item.inactiveText"
          ></el-switch>
          <el-upload
            v-else-if="item.type === 'upload'"
            class="avatar-uploader"
            action="#"
            :show-file-list="false"
            :on-success="handleAvatarSuccess"
          >
            <img v-if="form[item.prop]" :src="form[item.prop]" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon">
              <Plus />
            </el-icon>
          </el-upload>
          <el-tree-select
            v-else-if="item.type === 'treeSelect'"
            v-model="form[item.prop]"
            :data="item.opts"
            :render-after-expand="false"
            style="width: 240px"
          >
          </el-tree-select>
          <slot :name="item.prop" v-else> </slot>
        </el-form-item>
      </el-col>
    </el-row>

    <el-form-item>
      <div style="width: 100%; display: flex; flex-direction: row-reverse">
        <el-button type="primary" @click="saveEdit(formRef)">{{
          t('components.tableEdit.save')
        }}</el-button>
      </div>
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { type FormOption } from '@/types/form-option'
import type { FormInstance, FormRules, UploadProps } from 'element-plus'
import { type PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { options, formData, edit, update } = defineProps({
  options: {
    type: Object as PropType<FormOption>,
    required: true
  },
  formData: {
    type: Object,
    required: true
  },
  edit: {
    type: Boolean,
    required: false
  },
  update: {
    type: Function,
    required: true
  }
})

const form = ref({ ...(edit ? formData : {}) })
// const form = ref({ formData });

const rules: FormRules = options.list
  .map((item) => {
    const itemRules = []
    if (item.required) {
      itemRules.push({
        required: true,
        message: t('components.tableEdit.required', { label: item.label }),
        trigger: 'blur'
      })
    }
    if (item.rules) {
      itemRules.push(item.rules)
    }
    return { [item.prop]: itemRules }
  })
  .reduce((acc, cur) => ({ ...acc, ...cur }), {})

const formRef = ref<FormInstance>()
const saveEdit = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.validate((valid) => {
    if (!valid) return false
    update(form.value)
  })
}

const handleAvatarSuccess: UploadProps['onSuccess'] = (response, uploadFile) => {
  form.value.thumb = URL.createObjectURL(uploadFile.raw!)
}
</script>

<style>
.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.el-icon.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  text-align: center;
}
</style>
