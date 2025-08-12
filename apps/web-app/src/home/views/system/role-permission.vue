<template>
  <div class="h100p flex flex-column justify-between">
    <el-tree
      class="mgb10 oa flex1"
      ref="tree"
      :data="data"
      node-key="id"
      default-expand-all
      check-on-click-node
      check-strictly
      show-checkbox
      :default-checked-keys="checkedKeys"
    />
    <div class="oh">
      <el-button type="primary" class="fr" @click="onSubmit">保存权限</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElTree } from 'element-plus'
import { userAuth } from '@/states/UserState'
import { resourceApi } from '@/api'
import { ElMessage } from 'element-plus'

const props = defineProps({
  permissOptions: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['updateVisible'])

const menuObj = ref({})

const getTreeData = (data) => {
  return data.map((item) => {
    const obj: any = {
      id: item.id,
      role: item.role,
      label: item.title
    }
    if (item.children) {
      menuObj.value[item.id] = item.children.map((sub) => sub.id)
      obj.children = getTreeData(item.children)
    }
    return obj
  })
}
const data = ref([])
onMounted(() => {
  resourceApi.query_tree().then((res: any) => {
    const result = res.data
    data.value = getTreeData(result)
  })
})

// 获取当前权限
const checkedKeys = ref<string[]>(props.permissOptions.permiss)

// 保存权限
const tree = ref<InstanceType<typeof ElTree>>()
const onSubmit = () => {
  // 获取选中的菜单
  const currentChooseMenu = tree.value!.getCheckedNodes()
  userAuth.value.roles = currentChooseMenu.map((ele) => ele.role)

  // 获取选中的权限
  const keys: any[] = [
    ...tree.value!.getCheckedKeys(false),
    ...tree.value!.getHalfCheckedKeys()
  ] as number[]
  const data = {
    user_id: props.permissOptions.id,
    resource_ids: keys
  }
  resourceApi.update(data).then((res: any) => {
    ElMessage({ message: '更新成功', type: 'success' })
    emits('updateVisible')
  })
}
</script>

<style scoped></style>
