<template>
  <div class="attr-panel">
    <div class="attr-section">类别 · CATEGORY</div>
    <el-form :model="mainAnnoStates" label-position="top" class="obj3d-form">
      <el-form-item label="类别">
        <div class="attr-pair attr-pair--cat">
          <el-input v-model="mainAnnoStates.selected.object_type" />
          <el-popover placement="bottom" width="450" trigger="click">
            <template #reference>
              <el-button>
                <Icon icon="lucide:arrow-down" class="el-icon--right" />
              </el-button>
            </template>
            <div>
              <TaxonomyTreeSelecter
                @change="handleClassChange"
                @buttonClick="handleTreeNodeClick"
                selectedValue=""
              />
            </div>
          </el-popover>
        </div>
      </el-form-item>

      <div class="attr-section">标识 · IDS</div>
      <el-form-item label="目标ID">
        <el-input v-model="mainAnnoStates.selected.object_id" @change="onUserEdit"/>
      </el-form-item>
      <el-form-item label="框ID">
        <el-input v-model="mainAnnoStates.selected.label_uuid" @change="onUserEdit"/>
      </el-form-item>

      <div class="attr-section">几何 · GEOMETRY</div>
      <el-form-item label="位置 · X / Y">
        <div class="attr-pair">
          <el-input-number
            v-model="mainAnnoStates.selected.val[0]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
          <el-input-number
            v-model="mainAnnoStates.selected.val[1]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
        </div>
      </el-form-item>
      <el-form-item label="位置 · Z">
        <el-input-number
          v-model="mainAnnoStates.selected.val[2]"
          :precision="4"
          :step="0.1"
          controls-position="right"
          style="width: 100%;"
          @change="onUserEdit"
        />
      </el-form-item>
      <el-form-item label="缩放 · X / Y">
        <div class="attr-pair">
          <el-input-number
            v-model="mainAnnoStates.selected.val[6]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
          <el-input-number
            v-model="mainAnnoStates.selected.val[7]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
        </div>
      </el-form-item>
      <el-form-item label="缩放 · Z">
        <el-input-number
          v-model="mainAnnoStates.selected.val[8]"
          :precision="4"
          :step="0.1"
          controls-position="right"
          style="width: 100%;"
          @change="onUserEdit"
        />
      </el-form-item>
      <el-form-item label="旋转 · X / Y">
        <div class="attr-pair">
          <el-input-number
            v-model="mainAnnoStates.selected.val[3]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
          <el-input-number
            v-model="mainAnnoStates.selected.val[4]"
            :precision="4"
            :step="0.1"
            controls-position="right"
            @change="onUserEdit"
          />
        </div>
      </el-form-item>
      <el-form-item label="旋转 · Z">
        <el-input-number
          v-model="mainAnnoStates.selected.val[5]"
          :precision="4"
          :step="0.1"
          controls-position="right"
          style="width: 100%;"
          @change="onUserEdit"
        />
      </el-form-item>
    </el-form>

    <div class="attr-section">属性 · ATTRS</div>
    <VueForm
      id="propertyForm"
      ref="propertyForm"
      v-model="attributesFormData"
      :schema="selectedObjTypeAttrSchema"
      :formProps="{ labelPosition: 'top' }"
      :formFooter="{ show: false }"
      @change="handleProptertyFormChange"
    />
  </div>
</template>

<script lang="tsx" setup>
import { Icon } from "@iconify/vue"
import { ref, watch, reactive, computed } from 'vue'
import TaxonomyTreeSelecter from '@/components/Taxonomy/TaxonomyTreeSelecter.vue'
import VueForm from '@lljj/vue3-form-element'
import { entityChannel, commonChannel } from '@/video/channel'
import { taxonomyState } from '@/states/TaxonomyState'
import { mainAnnoStates } from '../../../states'
import _ from 'lodash'
import { glBoxAnnotationManager } from '@/pointcloud/render/annotation/box3d-annotation'


const onUserEdit = () => {
  glBoxAnnotationManager.getCurrent().update(mainAnnoStates.selected.label_uuid, mainAnnoStates.selected)
}

/**
 * 选择类别变化
 * @param value 选择的类别
 */
const handleClassChange = (value) => {
  mainAnnoStates.selected.object_type = value
}
/**
 * 关闭tree
 */
const handleTreeNodeClick = (msg) => {
  entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
    data: msg.data.name
  })
  // unref(popoverRef).hide()
}

const attributesFormData = computed({
  get: () => {
    const attr = _.get(mainAnnoStates.selected, 'object_attributes', undefined)
    if (attr) {
      return attr
    }

    // 动态form默认值
    if (taxonomyState.classNameToClass) {
      taxonomyState.classNameToClass.forEach((v, k) => {
        if (k === mainAnnoStates.defaultObjType) {
          const obj = {}
          _.forIn(v.properties, (value, key) => {
            _.set(obj, key, _.get(value, 'default', ''))
          })
          return obj
        }
      })
    }
    return {}
  },
  set: (val) => {
    _.set(mainAnnoStates.selected, 'object_attributes', val)
    mainAnnoStates.selected.attributes.opType = 'update'
  }
})

const defaultSchema = {
  type: 'object',
  required: [],
  'ui:order': ['*'],
  properties: {
    tags: {
      type: 'string',
      title: 'tags'
    },
    annotation: {
      type: 'string',
      title: 'annotation'
    }
  }
}
const selectedObjTypeAttrSchema = ref({})
selectedObjTypeAttrSchema.value = { ...defaultSchema }

/**
 * 属性面板变化
 */
const handleProptertyFormChange = () => {
  mainAnnoStates.selected.attributes.opType = 'update'
}

const changeSchema = () => {
  const defaultObjType = mainAnnoStates.defaultObjType
  if (taxonomyState.classNameToClass.has(defaultObjType)) {
    selectedObjTypeAttrSchema.value.properties =
      taxonomyState.classNameToClass.get(defaultObjType).properties
  } else {
    selectedObjTypeAttrSchema.value = { ...defaultSchema }
  }
}

watch([() => mainAnnoStates.defaultObjType], (newVal, oldVal) => {
  changeSchema()
})
watch(
  () => mainAnnoStates.selected,
  (newVal, oldVal) => {
    mainAnnoStates.selected.attributes.opType = 'update'
  },
  { deep: true }
)
</script>
<style scoped>
.obj3d-form :deep(.el-form-item) {
  margin-bottom: 8px;
}
</style>
