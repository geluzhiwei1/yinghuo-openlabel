import { defineComponent, ref, unref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import TaxonomyTreeSelecter from '@/components/Taxonomy/TaxonomyTreeSelecter.vue'
import { entityChannel } from '../channel'
import { Mission } from '@/constants'
import { jobConfig } from '@/states/job-config'


export default defineComponent({
  props: {
    formData: {
      // type: IRect,
      default: {
        id: '',
        x: 0.0,
        y: 0.0,
        width: 0.0,
        height: 0.0,
        entityId: '',
        className: ''
      },
      required: true
    }
  },
  setup(props) {
    const popoverRef = ref()

    /**
     * 选择类别变化
     * @param value 选择的类别
     */
    const handleClassChange = (value) => {
      // props.formData.className = value
      entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
        data: value
      })
    }
    /**
     * 关闭tree
     */
    const handleTreeNodeClick = (msg) => {
      entityChannel.pub(entityChannel.Events.DefaultClassChanged, {
        data: msg.data.name
      })
      unref(popoverRef).hide()
    }

    const renderFormItems = () => {
      switch (jobConfig.mission) {
        case Mission.ObjectDet2d:
        case Mission.TrafficSignal2d:
          return (
            <>
              <el-form-item label="目标ID">
                <el-input v-model={props.formData.entityId} />
              </el-form-item>
              <el-form-item label="左上x,y">
                <el-row>
                  <el-col span={12}>
                    <el-input v-model={props.formData.x} />
                  </el-col>
                  <el-col span={12}>
                    <el-input v-model={props.formData.y} />
                  </el-col>
                </el-row>
              </el-form-item>
              <el-form-item label="dimx,dimy">
                <el-row>
                  <el-col span={12}>
                    <el-input v-model={props.formData.width} />
                  </el-col>
                  <el-col span={12}>
                    <el-input v-model={props.formData.height} />
                  </el-col>
                </el-row>
              </el-form-item>
            </>
          )
        default:
          break
      }
    }

    return () => (
      <div>
        <el-form model={props.formData} label-width="120px" label-position="top">
          <el-form-item label="类别">
            <el-popover
              ref={popoverRef}
              placement="bottom"
              width={400}
              height={500}
              trigger={'click'}
              hide-after={0}
              v-slots={{
                reference: ()=>(
                  <el-button max-width="50">
                    {props.formData.className}
                    <el-icon class="el-icon--right">
                      <ArrowDown />
                    </el-icon>
                  </el-button>
                )
              }}
            >
              <div>
                {' '}
                <TaxonomyTreeSelecter
                  v-model={props.formData.className}
                  onChange={handleClassChange}
                  onButtonClick={handleTreeNodeClick}
                  selectedValue=''
                />{' '}
              </div>
            </el-popover>
          </el-form-item>
          {renderFormItems()}
        </el-form>
        {/* { renderFormItems() } */}
        {/* { renderDynamicForm() } */}
      </div>
    )
  }
})
