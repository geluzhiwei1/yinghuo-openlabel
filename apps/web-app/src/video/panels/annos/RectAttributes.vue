<template>
    <el-form :model='bboxAnnotaterStates' label-width="80px" label-position="left">
      <el-form-item label="类别">
        <el-row>
          <el-col :span="18">
            <el-input style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.object_type" />
          </el-col>
          <el-col :span="6">
            <el-popover placement="bottom" width="450" trigger="click">
              <template #reference>
                <el-button>
                  <el-icon class="el-icon--right">
                    <ArrowDown />
                  </el-icon>
                </el-button>
              </template>
              <div>
                <TaxonomyTreeSelecter @change="handleClassChange" @buttonClick="handleTreeNodeClick" selectedValue='' />
              </div>
            </el-popover>
          </el-col>
        </el-row>

      </el-form-item>
      <el-form-item label="目标ID">
        <el-input v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.object_id" />
      </el-form-item>
      <el-form-item label="框ID">
        <el-input v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.label_id" />
      </el-form-item>
      <el-form-item label="框UUID" :required="true">
        <el-input v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.label_uuid" :readonly="true"/>
      </el-form-item>
      <el-form-item label="中心x,y">
        <el-row>
          <el-col :span="12">
            <el-input-number style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.val[0]"
              :precision="4" :step="0.1" controls-position="right" />
          </el-col>
          <el-col :span="12">
            <el-input-number style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.val[1]"
              :precision="4" :step="0.1" controls-position="right" />
          </el-col>
        </el-row>
      </el-form-item>
      <el-form-item label="宽高w,h">
        <el-row>
          <el-col :span="12">
            <el-input-number style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.val[2]"
              :precision="4" :step="0.1" controls-position="right" />
          </el-col>
          <el-col :span="12">
            <el-input-number style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.val[3]"
              :precision="4" :step="0.1" controls-position="right" />
          </el-col>
        </el-row>
      </el-form-item>
      <el-form-item label="角度" v-if="bboxAnnotaterStates.selectedFabricObj.userData.anno.ol_type_ === 'RBBox'">
        <el-row>
          <el-col :span="12">
            <el-input-number style="width:auto" v-model="bboxAnnotaterStates.selectedFabricObj.userData.anno.val[4]"
              :precision="4" :step="0.1" controls-position="right" />
          </el-col>
          <el-col :span="12">
          </el-col>
        </el-row>
      </el-form-item>
    </el-form>
    <VueForm id="propertyForm" ref="propertyForm" v-model="attributesFormData" :schema="selectedObjTypeAttrSchema"
      :formProps="{ labelPosition: 'top' }" :formFooter="{ show: false }" @change="handleProptertyFormChange" />
</template>

<script lang="tsx" setup>
import { ref, watch, reactive, computed } from 'vue'
import { ElForm, ElRow, ElCol, ElInput, ElButton, ElPopover, ElIcon, ElFormItem, ElInputNumber, ElScrollbar } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import TaxonomyTreeSelecter from '@/components/Taxonomy/TaxonomyTreeSelecter.vue'
import VueForm from '@lljj/vue3-form-element'
import { entityChannel, commonChannel } from '@/video/channel'
import { taxonomyState } from '@/states/TaxonomyState'
import { bboxAnnotaterStates } from '@/video/annotaters/bboxAnnotater'
import _ from 'lodash'


/**
 * 选择类别变化
 * @param value 选择的类别
 */
const handleClassChange = (value) => {
  bboxAnnotaterStates.selectedFabricObj.userData.anno.object_type = value
}
/**
 * 关闭tree
 */
const handleTreeNodeClick = (msg) => {
  entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
    data: msg.data.name
  })
}


const attributesFormData = computed({
  get: () => {
    const attr = bboxAnnotaterStates.selectedFabricObj?.userData.anno.object_attributes
    if (attr) {
      return attr
    }

    // 动态form默认值
    if (taxonomyState.classNameToClass) {
      taxonomyState.classNameToClass.forEach((v, k) => {
        if (k === bboxAnnotaterStates.defaultObjType) {
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
    bboxAnnotaterStates.selectedFabricObj.userData.anno.object_attributes = val
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
  // if (!attrPanel.focused) return
  // const msg = {
  //   source: 'ui',
  //   data: {
  //     id: formData.id,
  //     attributes: attributesFormData.value
  //   }
  // }
  // entityChannel.pub(entityChannel.Events.Updated, msg)
}

const changeSchema = () => {
  const defaultObjType = bboxAnnotaterStates.defaultObjType
  if (taxonomyState.classNameToClass.has(defaultObjType)) {
    selectedObjTypeAttrSchema.value.properties = taxonomyState.classNameToClass.get(defaultObjType).properties
  } else {
    selectedObjTypeAttrSchema.value = { ...defaultSchema }
  }
}

// watch([() => taxonomyState.ontology,
// () => taxonomyState.ontologyClassNames], (newVal, oldVal) => {
//   if (newVal[0] && newVal[1]) {
//     bboxAnnotaterStates.defaultObjType = 'default'
//   }
// })

// watch(() => taxonomyState.ontologyClassNames, (newVal, oldVal) => {
//   bboxAnnotaterStates.setting.objTypes = newVal.data
// })


watch([() => bboxAnnotaterStates.defaultObjType], (newVal, oldVal) => {
  changeSchema()
})

</script>
<style scoped>
.el-form-item {
  margin-bottom: 0px;
}
</style>
<style>
.genFormItem {
  margin-bottom: 0px;
}
</style>