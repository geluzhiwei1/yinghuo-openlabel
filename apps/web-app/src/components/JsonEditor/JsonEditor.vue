<template>
  <div ref="jsonEditorVue" class="json-editor-vue" />
</template>

<script>
import JsonEditor from 'jsoneditor'
import 'jsoneditor/dist/jsoneditor.min.css'

export default {
  editor: null,
  name: 'json-editor-vue',
  props: {
    jsonData: Object,
    options: Object,
    currentMode: {
      type: String,
      default: 'code'
    },
    modeList: {
      type: Array,
      default: () => ['tree', 'code', 'text']
    },
    language: {
      type: String,
      default: 'zh-CN'
    }
  },
  data() {
    return {
      json: this.modelValue
    }
  },
  mounted() {
    this.init()
  },
  unmounted() {
    this.editor?.destroy()
    this.editor = null
  },
  methods: {
    init() {
      const { currentMode, modeList, options } = this
      const onSelectionChange = (start, end) => {
        this.$emit('selectionChange', this.editor, start, end)
      }
      const onBlur = ({ target }) => {
        this.$emit('blur', this.editor, target)
      }
      const onValidationError = (errors) => {
        this.$emit('validationError', this.editor, errors)
      }
      const finalOptions = {
        indentation: 2,
        language: this.language,
        mode: currentMode,
        modes: modeList,
        onSelectionChange,
        onBlur,
        onValidationError,
        ...options
      }
      this.editor = new JsonEditor(this.$refs.jsonEditorVue, finalOptions, this.jsonData)
      // watch(() => this.jsonData, (newVal) => {
      //   this.editor.set(newVal);
      // });
    }
  }
}
</script>
