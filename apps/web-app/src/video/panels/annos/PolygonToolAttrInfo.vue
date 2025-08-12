<template>
  <el-form :model='poly2dAnnotaterStates' label-width="80px" label-position="left">
    <el-form-item label="类别">
      <el-row>
        <el-col :span="18"><el-input v-model="poly2dAnnotaterStates.selectedFabricObj.userData.anno.object_type" />
        </el-col>
        <el-col :span="6">
          <el-popover placement="bottom" width="550" trigger="click">
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
    <el-form-item label="Id">
      <el-input v-model="poly2dAnnotaterStates.selectedFabricObj.userData.anno.label_uuid" />
    </el-form-item>
    <el-form-item label="Object Id">
      <el-input v-model="poly2dAnnotaterStates.selectedFabricObj.userData.anno.label_id" />
    </el-form-item>
  </el-form>
  <VueForm id="propertyForm" ref="propertyForm" v-model="attributesFormData" :schema="selectedObjTypeAttrSchema"
    :formProps="{ labelPosition: 'top' }" :formFooter="{ show: false }" @change="handleProptertyFormChange" />
</template>

<script lang="tsx" setup>
import { ref, watch, reactive, computed } from 'vue'
import { ElForm, ElRow, ElCol, ElInput, ElButton, ElPopover, ElIcon, ElFormItem, ElInputNumber } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import TaxonomyTreeSelecter from '@/components/Taxonomy/TaxonomyTreeSelecter.vue'
import VueForm from '@lljj/vue3-form-element'
import { entityChannel, commonChannel } from '@/video/channel'
import { taxonomyState } from '@/states/TaxonomyState'
import { attrPanel } from '@/states/UiState'
import { poly2dAnnotaterStates } from '@/video/annotaters/polylineAnnotater'
import _ from 'lodash'


/**
 * 选择类别变化
 * @param value 选择的类别
 */
const handleClassChange = (value) => {
  // entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
  //   data: value
  // })
  poly2dAnnotaterStates.selectedFabricObj.userData.anno.object_type = value
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
    const attr = _.get(poly2dAnnotaterStates, "selectedFabricObj.userData.anno.object_attributes", undefined)
    if (attr) {
      return attr
    }

    // 动态form默认值
    if (taxonomyState.classNameToClass) {
      taxonomyState.classNameToClass.forEach((v, k) => {
        if (k === poly2dAnnotaterStates.defaultObjType) {
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
    _.set(poly2dAnnotaterStates, "selectedFabricObj.userData.anno.object_attributes", val)
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
selectedObjTypeAttrSchema.value = defaultSchema

const resetDynamicForm = (current_class_name) => {
  // Object.assign(formData, {
  //   className: _.isEmpty(current_class_name) ? taxonomyState.ontologyClassNames[0] : current_class_name
  // })
  // schema and ui
  // if (taxonomyState.classNameToClass.has(formData.className)) {
  //   selectedObjTypeAttrSchema.value.properties = taxonomyState.classNameToClass.get(formData.className).properties
  // }
}

/**
 * 框信息改变
 */
const handleFormChange = () => {
  if (!attrPanel.focused) return
  entityChannel.pub(entityChannel.Events.Updated, {
    source: 'ui',
    data: {
      id: formData.id,
      x: formData.x,
      y: formData.y,
      width: formData.width,
      height: formData.height
    }
  })
}

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

const onDataReady = () => {

  // 设置默认类别
  // entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
  //   data: taxonomyState.ontologyClassNames[0]
  // })
}

const changeSchema = () => {
  const defaultObjType = poly2dAnnotaterStates.defaultObjType
  if (taxonomyState.classNameToClass.has(defaultObjType)) {
    selectedObjTypeAttrSchema.value.properties = taxonomyState.classNameToClass.get(defaultObjType).properties
  } else {
    selectedObjTypeAttrSchema.value = defaultSchema
  }
}

watch([() => taxonomyState.ontology,
() => taxonomyState.ontologyClassNames], (newVal, oldVal) => {
  if (newVal[0] && newVal[1]) {
    poly2dAnnotaterStates.defaultObjType = 'default'
  }
})

watch(() => taxonomyState.ontologyClassNames, (newVal, oldVal) => {
  poly2dAnnotaterStates.setting.objTypes = newVal.data
})


watch([() => poly2dAnnotaterStates.defaultObjType], (newVal, oldVal) => {
  changeSchema()
})


// sub = entityChannel.sub(entityChannel.Events.SelectedBoxChanged, (msg) => {
//   if (msg.data) {
//     // 目标
//     resetDynamicForm(msg.data.attribute)
//     // 目标值
//     Object.assign(formData, {
//       ...msg.data
//     })
//     _.set(formData, 'className', msg.data.attribute)

//     // 目标属性值
//     Object.assign(attributesFormData.value, {
//       ...msg.data.attributes
//     })
//   } else {
//     // formData.current_class = msg.data.attribute
//   }
// })
// subs.push(sub)
// onUnmounted(() => {
//   subs.map((ele) => {
//     ele.unsubscribe()
//   })
// })
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