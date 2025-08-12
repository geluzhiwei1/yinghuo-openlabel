<template>
  <el-button-group class="ml-4">
    <el-popover
      placement="bottom-end"
      :width="300"
      trigger="click"
      size="small"
      title="新建实例"
      :visible="uiState.createInstance.uiVisible"
    >
      <template #reference>
        <el-button
          :icon="CirclePlusFilled"
          size="small"
          type="danger"
          @click.stop="uiState.createInstance.uiVisible = true"
        />
      </template>
      <div>
        <el-row>
          <el-col :span="12">实例id</el-col>
          <el-col :span="12"><el-input v-model="dummyKey" /></el-col>
        </el-row>
        <el-row>
          <el-col :span="12">类别</el-col>
          <el-col :span="12"
            ><el-select v-model="value" placeholder="Select">
              <el-option
                v-for="item in cities"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <span style="float: left">{{ item.label }}</span>
                <span
                  style="float: right; color: var(--el-text-color-secondary); font-size: 13px"
                  >{{ item.value }}</span
                >
              </el-option>
            </el-select></el-col
          >
        </el-row>
        <el-row>
          <el-col :span="12">点数</el-col>
          <el-col :span="12"><el-input place-holder="至少选择一个点" /></el-col>
        </el-row>
        <el-row justify="end">
          <el-col :span="12" style="text-align: right"
            ><el-button @click.stop="uiState.createInstance.uiVisible = false"
              >关闭</el-button
            ></el-col
          ><el-col :span="12"
            ><el-button @click.stop="uiState.createInstance.uiVisible = false"
              >确定</el-button
            ></el-col
          ></el-row
        >
      </div>
    </el-popover>

    <el-popconfirm
      width="220"
      confirm-button-text="是"
      cancel-button-text="否"
      :icon="WarningFilled"
      icon-color="#626AEF"
      title="是否要清除已标注的语义点? 操作不可恢复。"
      @confirm.stop="handleDeleteAll"
    >
      <template #reference>
        <el-button :icon="DeleteFilled" size="small" type="danger" />
      </template>
    </el-popconfirm>
  </el-button-group>
  <el-table
    :data="filterTableData"
    :key="dummyKey"
    style="width: 100%"
    table-layout="auto"
    class="scrollbar-table"
    max-height="1000"
    highlight-current-row
    @current-change="handleCurrentChange"
  >
    <el-table-column min-width="35px">
      <template #default="scope">
        <el-popover effect="light" trigger="hover" placement="top" width="auto">
          <template #default>
            <p>标签：{{ scope.row.name }}</p>
            <p>标签id：{{ scope.row.label_id }}</p>
            <span v-html="scope.row.properties.description"></span>
          </template>
          <template #reference>
            <el-button
              :icon="InfoFilled"
              circle
              size="small"
              style="font-size: 20px"
              :style="{ color: scope.row.color }"
            />
          </template>
        </el-popover>
      </template>
    </el-table-column>
    <el-table-column min-width="100px">
      <template #header>
        <el-input v-model="search" size="small" placeholder="过滤" />
      </template>
      <template #default="scope">
        {{ scope.row.name }}
      </template>
    </el-table-column>
    <el-table-column>
      <template #default="scope">
        <el-button-group class="ml-4">
          <el-button
            :icon="Hide"
            circle
            size="small"
            :style="{ color: scope.row.mute ? 'blue' : '' }"
            @click.stop="handleMute(scope.$index, scope.row)"
          />
          <el-button
            :icon="View"
            circle
            size="small"
            :style="{ color: scope.row.solo ? 'blue' : '' }"
            @click.stop="handleSolo(scope.$index, scope.row)"
          />
          <el-popconfirm
            width="220"
            confirm-button-text="是"
            cancel-button-text="否"
            :icon="WarningFilled"
            icon-color="#626AEF"
            title="是否清除该类别？操作不可恢复。"
            @confirm.stop="handleDelete(scope.$index, scope.row)"
          >
            <template #reference>
              <el-button
                :icon="Delete"
                circle
                size="small"
                :disabled="scope.row.label_id === 0 ? true : false"
              />
            </template>
          </el-popconfirm>
        </el-button-group>
      </template>
    </el-table-column>
    <el-table-column label="点数">
      <template #default="scope">
        {{ state.counters[scope.row.label_id] }}
      </template>
    </el-table-column>
  </el-table>
</template>

<script lang="js">
import { computed, ref, toRaw, defineComponent } from 'vue'
import {
  ElTable,
  ElTableColumn,
  ElPopover,
  ElIcon,
  ElButton,
  ElButtonGroup,
  ElInput,
  ElPopconfirm,
  ElRow,
  ElCol,
  ElSelect,
  ElOption
} from 'element-plus'
import {
  View,
  Hide,
  Delete,
  Timer,
  WarningFilled,
  DeleteFilled,
  InfoFilled,
  CirclePlusFilled
} from '@element-plus/icons-vue'
// import SseToolbar from '@/seman3d/sem/common/SseToolbar'

export default defineComponent({
  name: 'Instances',
  components: {
    ElTable,
    ElTableColumn,
    ElPopover,
    ElPopover,
    ElButton,
    ElButtonGroup,
    ElInput,
    ElPopconfirm,
    ElSelect,
    ElOption,
    ElCol,
    ElRow
  },
  extends: SseToolbar,
  setup() {
    return {
      View,
      Hide,
      Delete,
      Timer,
      WarningFilled,
      DeleteFilled,
      InfoFilled,
      CirclePlusFilled
    }
  },
  data() {
    return {
      uiState: {
        createInstance: {
          uiVisible: false
        }
      },
      state: {
        counters: {},
        soc: null,
        activeClassIndex: 0
      },
      filterTableData: [],
      search: '',
      dummyKey: 0,
      cities: [
        {
          value: 'Beijing',
          label: 'Beijing'
        },
        {
          value: 'Shanghai',
          label: 'Shanghai'
        },
        {
          value: 'Nanjing',
          label: 'Nanjing'
        },
        {
          value: 'Chengdu',
          label: 'Chengdu'
        },
        {
          value: 'Shenzhen',
          label: 'Shenzhen'
        },
        {
          value: 'Guangzhou',
          label: 'Guangzhou'
        }
      ],
      value: ''
    }
  },
  created() {
    this.mode = '3d'
    this.pendingState.counters = {}
    // let res = getClassesSets()
    // this.classesSets = res.map((cset) => new SseSetOfClasses(cset))
    // this.classesReady = true
    // this.classesSetByName = new Map()
    // this.classesSets.map((cset) => {
    //   this.classesSetByName.set(cset.name, cset)
    // })
    // TODO add label field
    LabelDef.objects.forEach((obj) => {
      obj['label'] = obj['name']
      obj['mute'] = false
      obj['solo'] = false
    })
    this.currentClasses = LabelDef
    this.state.soc = this.currentClasses

    // 语义分割类别
    this.filterTableData = this.currentClasses.objects.filter(
      (data) => !this.search || data.name.toLowerCase().includes(this.search.toLowerCase())
    )
  },
  mounted() {
    this.sendMsg('active-soc', {
      value: this.currentClasses
    })
  },
  methods: {
    handleCurrentChange(currentRow) {
      // 选择的类别改变
      this.sendMsg('classSelection', {
        descriptor: toRaw(currentRow)
      })
    },

    /**
     * 清除所有类别
     */
    handleDeleteAll() {
      const labelIds = []
      toRaw(this.filterTableData).forEach((v) => {
        labelIds.push(v.label_id)
      })
      this.sendMsg('sem-clear-label', { labelIds: labelIds })
    },
    /**
     * 清除指定类别
     * @param {*} index
     * @param {*} row
     */
    handleDelete(index, row) {
      const clsDesc = toRaw(row)
      this.sendMsg('sem-clear-label', { labelIds: [clsDesc.label_id] })
    },
    /**
     * 隐藏这个类
     * @param {*} index
     * @param {*} row
     */
    handleMute(index, row) {
      const clsDesc = toRaw(row)
      if (this.state.counters[clsDesc.label_id]) {
        clsDesc.mute = !clsDesc.mute
        this.sendMsg('mute', clsDesc)

        // 更新ui
        this.filterTableData.forEach((data) => {
          if (clsDesc.label_id === data.label_id) {
            data.mute = clsDesc.mute
          }
        })
        this.dummyKey = Math.random()
      }
    },
    /**
     * 仅显示这个类
     * @param {*} index
     * @param {*} row
     */
    handleSolo(index, row) {
      const clsDesc = toRaw(row)
      // this.displayOther('solo', clsDesc, clsDesc.label_id)
      if (this.state.counters[clsDesc.label_id]) {
        clsDesc.solo = !clsDesc.solo
        this.sendMsg('solo', clsDesc)

        // 更新ui
        this.filterTableData.forEach((data) => {
          if (clsDesc.label_id === data.label_id) {
            data.solo = clsDesc.solo
          }
        })
        this.dummyKey = Math.random()
      }
    },
    messages() {
      this.onMsg('classSelection', (arg) => {
        this.state.activeClassIndex = arg.descriptor.label_id
      })
      this.onMsg('label_id-select', (arg) => {
        this.state.activeClassIndex = arg.value
      })
      this.onMsg('class-instance-count', (arg) => {
        this.pendingState.counters[arg.label_id] = arg.count
        this.invalidate()
      })
      this.onMsg('currentSample', (arg) => {
        if (arg.data.socName) this.changeClassesSet(arg.data.socName)
      })
      this.onMsg('editor-ready', (arg) => {
        this.sendMsg('active-soc', {
          value: this.currentClasses
        })
        // if (arg && arg.value && arg.value.socName)
        //   this.sendMsg('active-soc', {
        //     value: this.currentClasses
        //   })
        // else
        //   this.sendMsg('active-soc', {
        //     value: this.currentClasses
        //   })
      })
      this.onMsg('active-soc', (arg) => {
        // this.state.soc = arg.value
        this.displayAll()
      })
      this.onMsg('active-soc-name', (arg) => {
        this.sendMsg('active-soc', {
          value: this.currentClasses
        })
      })
    },
    displayAll() {
      this.filterTableData.forEach((obj) => {
        obj['mute'] = false
        obj['solo'] = false
      })
      this.dummyKey = Math.random()
    },
    // toggleButton(prop, idx) {
    //   const o = {}
    //   const p = this[prop + idx] || false
    //   o[prop + idx] = !p
    //   Object.assign(this.state, o)
    // },
    // displayOther(name, argument, label_id) {
    //   if (
    //     this.state.counters[argument.label_id] ||
    //     (!this.state.counters[argument.label_id] && this[name + label_id])
    //   ) {
    //     // this.toggleButton(name, label_id)
    //     this.sendMsg(name, argument)
    //   }
    // },
    // changeClassesSet(name) {
    //   const newSoc = this.classesSetByName.get(name)
    //   const usedClasses = Object.keys(this.state.counters).filter((x) => this.state.counters[x] > 0)
    //   const missing = []
    //   usedClasses.forEach((x) => {
    //     if (!newSoc.labels.has(x)) {
    //       missing.push(x)
    //     }
    //   })
    //   //debugger;
    //   const t = this.state.counters
    //   let maxClassIndex = Math.max(...Object.keys(t).filter((k) => t[k] > 0))

    //   if (newSoc.descriptors.length >= maxClassIndex) {
    //     this.state.soc = newSoc
    //     this.classes = newSoc.descriptors
    //     this.mode = 'normal'
    //     this.state.activeClassIndex = 0
    //     this.sendMsg('active-soc', {
    //       value: newSoc
    //     })
    //   } else
    //     this.sendMsg('alert', {
    //       variant: 'error',
    //       forceCloseMessage: 'dismiss-not-enough-classes',
    //       message:
    //         'This set of classes only supports ' +
    //         newSoc.descriptors.length +
    //         ' different classes (index from 0 to ' +
    //         (newSoc.descriptors.length - 1) +
    //         ') but the current maximum class index for your data is ' +
    //         maxClassIndex
    //     })
    // },
    initSetChange() {
      this.mode = 'set-chooser'
    }
  }
})

const LabelDef = {
  name: 'semantic-kitti',
  objects: [
    {
      name: 'unlabeled',
      label_id: 0,
      color: '#A3A6AD',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'outlier',
      label_id: 1,
      color: '#0000ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'car',
      label_id: 10,
      color: '#f59664',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'bicycle',
      label_id: 11,
      color: '#f5e664',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'bus',
      label_id: 13,
      color: '#fa5064',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'motorcycle',
      label_id: 15,
      color: '#963c1e',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'on-rails',
      label_id: 16,
      color: '#ff0000',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'truck',
      label_id: 18,
      color: '#b41e50',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'other-vehicle',
      label_id: 20,
      color: '#ff0000',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'person',
      label_id: 30,
      color: '#1e1eff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'bicyclist',
      label_id: 31,
      color: '#c828ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'motorcyclist',
      label_id: 32,
      color: '#5a1e96',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'road',
      label_id: 40,
      color: '#ff00ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'parking',
      label_id: 44,
      color: '#ff96ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'sidewalk',
      label_id: 48,
      color: '#4b004b',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'other-ground',
      label_id: 49,
      color: '#4b00af',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'building',
      label_id: 50,
      color: '#00c8ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'fence',
      label_id: 51,
      color: '#3278ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'other-structure',
      label_id: 52,
      color: '#0096ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'lane-marking',
      label_id: 60,
      color: '#aaff96',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'vegetation',
      label_id: 70,
      color: '#00af00',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'trunk',
      label_id: 71,
      color: '#003c87',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'terrain',
      label_id: 72,
      color: '#50f096',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'pole',
      label_id: 80,
      color: '#96f0ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'traffic-sign',
      label_id: 81,
      color: '#0000ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'other-object',
      label_id: 99,
      color: '#ffff32',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-car',
      label_id: 252,
      color: '#f59664',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-bicyclist',
      label_id: 253,
      color: '#c828ff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-person',
      label_id: 254,
      color: '#1e1eff',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-motorcyclist',
      label_id: 255,
      color: '#5a1e96',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-on-rails',
      label_id: 256,
      color: '#ff0000',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-bus',
      label_id: 257,
      color: '#fa5064',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-truck',
      label_id: 258,
      color: '#b41e50',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    },
    {
      name: 'moving-other-vehicle',
      label_id: 259,
      color: '#ff0000',
      properties: {
        description:
          "<a href='https://baike.baidu.com/item/%E7%A6%81%E6%AD%A2%E6%A0%87%E7%BA%BF%E6%8C%87%E7%A4%BA/4716587?fr=aladdin'>\u6807\u6ce8\u8bf4\u660e\u548c\u793a\u4f8b</a>"
      }
    }
  ]
}
</script>
<style scoped>
.el-table {
  --el-table-row-hover-bg-color: #4ba416;
  --el-table-current-row-bg-color: #4ba416;
}
</style>
