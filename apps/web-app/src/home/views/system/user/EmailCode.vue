<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    v-loading="formLoading"
    label-position="right"
    label-width="auto"
    style="width: 380px"
  >
    <el-form-item label="邮箱验证" prop="username">
      <el-row style="justify-content: center; align-items: center; width: 100%">
        <el-col :span="18">
          <el-input
            v-model="form.username"
            maxlength="100"
            style="width: 100%"
            placeholder="请输入邮箱"
          />
        </el-col>
        <el-col :span="6">
          <el-button @click="submitForm(formRef)" type="primary">发送验证码</el-button>
        </el-col>
      </el-row>
      <el-row style="justify-content: center; align-items: center; width: 100%">
        <el-col :span="18">
          <el-input
            v-model="form.username"
            maxlength="100"
            style="width: 100%"
            placeholder="请输入您邮箱收到的6位数字"
          />
        </el-col>
        <el-col :span="6"> </el-col>
      </el-row>
    </el-form-item>

    <el-form-item>
      <el-row style="justify-content: center; align-items: center; width: 100%">
        <el-button @click="submitForm(formRef)" type="primary" :disabled="formLoading && capchaOk"
          >确定</el-button
        >
        <el-button @click="userLogin.visible = false">取消</el-button>
      </el-row>
    </el-form-item>
  </el-form>
</template>
<script setup lang="ts">
import { onMounted, toRaw, ref, reactive, watch } from 'vue'
import { ElButton, ElForm, ElFormItem, ElDialog, ElInput } from 'element-plus'
import { clone } from 'radash'

const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formRef = ref() // 表单 Ref
const capchaOk = ref(false) // capcha ok
const captchaVisible = ref(false) // capcha
const captchaSrc = ref('') // capcha
const rules = ref({
  username: [
    { required: true, message: '请输入账号' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 50, message: '长度为6-50', triggle: 'blur' }
  ],
  captchaText: [
    { required: true, message: '请输入验证码' },
    { min: 6, max: 6, message: '长度为6', triggle: 'blur' }
  ]
})

const formDefault = {
  username: '',
  password: '',
  captchaId: '',
  captchaText: ''
}
const form = reactive({ ...clone(formDefault) })
</script>
