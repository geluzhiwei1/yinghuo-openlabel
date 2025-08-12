import { reactive } from 'vue'
import ModelSelectorUI from './ModelSelector.vue'

export const dnnModelSelectorState = reactive({
  dialogVisible: false,
  selectedApi: null,
  apiCategory: '',
  onOk: null,
  onCancel: null
})

export { ModelSelectorUI }
