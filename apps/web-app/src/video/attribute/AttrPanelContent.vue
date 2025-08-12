<template>
  <MissionAttribute :formData="formData" @change="handleFormChange"></MissionAttribute>
  <VueForm
    id="propertyForm"
    ref="propertyForm"
    v-model="propertyFormData"
    :schema="current_schema"
    :formProps="{ labelPosition: 'top' }"
    :formFooter="{ show: false }"
    @change="handleProptertyFormChange"
  />
</template>

<script lang="ts" setup>
import { ref, watch, reactive, onUnmounted } from 'vue'
import VueForm from '@lljj/vue3-form-element'
import { entityChannel, commonChannel } from '../channel'
import _ from 'lodash'
import MissionAttribute from './MissionAttribute'
import {taxonomyState} from '@/states/TaxonomyState'
import { attrPanel } from '@/states/UiState'


const subs = []
let sub = null

const formData = reactive({})
const propertyFormData = ref({})
const current_schema = ref({
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
})

const resetDynamicForm = (current_class_name) => {
  Object.assign(formData, {
    className: _.isEmpty(current_class_name) ? taxonomyState.ontologyClassNames[0] : current_class_name
  })
  // schema and ui
  if (taxonomyState.classNameToClass.has(formData.className)) {
    current_schema.value.properties = taxonomyState.classNameToClass.get(formData.className).properties
  }

  // 动态form默认值
  taxonomyState.classNameToClass.forEach((v, k) => {
    if (k === formData.className) {
      const obj = {}
      _.forIn(v.properties, (value, key) => {
        _.set(obj, key, _.get(value, 'default', ''))
      })
      Object.assign(propertyFormData.value, {
        ...obj
      })
    }
  })
}

/**
 * 框信息改变
 */
const handleFormChange = () => {
  if (!attrPanel.value.focused) return
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
  if (!attrPanel.value.focused) return
  const msg = {
    source: 'ui',
    data: {
      id: formData.id,
      attributes: propertyFormData.value
    }
  }
  entityChannel.pub(entityChannel.Events.Updated, msg)
}

const onDataReady = () => {
  resetDynamicForm(null)
  // 设置默认类别
  entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
    data: taxonomyState.ontologyClassNames[0]
  })
}
watch([() => taxonomyState.ontology, 
       () => taxonomyState.ontologyClassNames], (newVal, oldVal) => {
  if (newVal[0] && newVal[1]) {
    onDataReady()
  }
})

sub = entityChannel.sub(entityChannel.Events.SelectedBoxChanged, (msg) => {
  if (msg.data) {
    // 目标
    resetDynamicForm(msg.data.attribute)
    // 目标值
    Object.assign(formData, {
      ...msg.data
    })
    _.set(formData, 'className', msg.data.attribute)

    // 目标属性值
    Object.assign(propertyFormData.value, {
      ...msg.data.attributes
    })
  } else {
    // formData.current_class = msg.data.attribute
  }
})
subs.push(sub)
onUnmounted(() => {
  subs.map((ele) => {
    ele.unsubscribe()
  })
})
</script>
