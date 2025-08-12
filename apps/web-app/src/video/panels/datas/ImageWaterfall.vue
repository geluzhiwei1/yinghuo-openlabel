<template>
  <el-button-group>
    <el-button type="primary" @click="switchCol(6)">6 Cols</el-button>
    <el-button type="primary" @click="switchCol(10)">10 Cols</el-button>
    <el-button type="primary" @click="loadmore">加载...</el-button>
  </el-button-group>
  <el-scrollbar :height="totalHeight + 'px'" v-loading="loading">
    <div class="container-water-fall">
      <waterfall :col="col" :data="data" @loadmore="loadmore" :gutterWidth="5" :height="totalHeight + 'px'">
        <div class="cell-item" v-for="(item, index) in data" :key="index" @click="() => handleClick(item)">
          
          <img v-if="jobConfig.data_source === 'localImage'" :src="URL.createObjectURL(pathBlobMap.get(item.uri))" alt="加载错误" />
          <img v-else :src="`${item.uri}?token=${userAuth.access_token}&uuid=${jobConfig.uuid}`" alt="加载错误" />

          <div class="item-body">
            <div class="item-desc">{{ item.imageName || '' }}</div>
            <div class="item-footer">
              <div class="name">{{ item.id }}</div>
              <div class="flex gap-2">
                <el-tag v-for="tag in item.tags" :key="tag.name" closable :type="tag.type">
                  {{ tag.name }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </waterfall>
    </div>
  </el-scrollbar>
</template>

<script lang="ts">
import { watch, ref } from 'vue'
import { ElButtonGroup, ElButton, ElTag, ElScrollbar } from "element-plus"
import { dataSeqState } from '@/states/DataSeqState'
import { get, mapEntries } from 'radash'
import { commonChannel } from '@/video/channel'
import { pathBlobMap } from '@/states/LocalFiles'
import { jobConfig } from '@/states/job-config'
import { userAuth } from '@/states/UserState'

// const loading = ref(true)
export default {
  props: {
    title: String,
    totalWidth: {
      type: Number,
      default: document.documentElement.clientWidth
    },
    totalHeight: {
      type: Number,
      default: document.documentElement.clientHeight
    }
  },
  components: {
    ElButtonGroup, ElButton, ElTag, ElScrollbar
  },
  data() {
    return {
      data: [] as any[],
      col: 6,
      loading: false,
      allDatas: [] as any[],
      page_size: 10,
      jobConfig,
      pathBlobMap,
      URL,
      userAuth
    };
  },
  computed: {
    itemWidth() {
      return 133 * 0.5 * (this.$props.totalWidth / 375);
    },
    gutterWidth() {
      return 10 * 0.5 * (this.$props.totalWidth / 375);
    },
  },
  methods: {
    switchCol(col: number) {
      this.col = col;
    },

    handleClick(item) {
      commonChannel.pub(commonChannel.Events.ChangingFrame, { data: item })
    },

    loadmore() {
      this.loading = true;
      // setTimeout(() => {
      const newList = this.allDatas.slice(this.data.length, this.data.length + this.page_size)// 每次取
      this.data = this.data.concat(newList)
      // if (this.data.length >= this.allDatas.length) {
      //   over.value = true
      // }
      this.loading = false;
      // }, 1000);
    },
    onDataReady(openlabel: any) {
      let arr: any[] = []
      Object.entries(openlabel.frames).forEach(([key, streamObj], index) => {
        arr.push({
          id: key,
          timestamp: get(streamObj, 'frame_properties.timestamp', ''),
          uri: get(streamObj, 'frame_properties.uri', ''),
          tags: []
        })
      })
      this.allDatas = arr.map(item => ({
        ...item,
        imageName: item.uri?.split('/').pop() || undefined
      }))
      this.loadmore()
    }
  },
  mounted() {
    watch(() => dataSeqState.streamMeta, async (newVal) => {
      this.onDataReady(newVal.openlabel)
    }, { immediate: true })
  }
};
</script>

<style lang="less" scoped>
* {
  margin: 0;
}

.container-water-fall {
  // padding: 0 28px;
  // width: 85vw;
  text-align: center;
  box-sizing: border-box;

  h4 {
    padding-top: 56px;
    padding-bottom: 28px;
    font-family: PingFangSC-Medium;
    font-size: 36px;
    color: #000000;
    letter-spacing: 1px;
    text-align: justify;
  }

  .cell-item {
    width: 100%;
    // margin-bottom: 18px;
    background: #ffffff;
    border: 2px solid #f0f0f0;
    border-radius: 12px 12px 12px 12px;
    overflow: hidden;
    box-sizing: border-box;
    margin-bottom: 10px;

    img {
      // border-radius: 12px 12px 0 0;
      width: 100%;
      height: auto;
      display: block;
    }

    .item-body {
      // border: 1px solid #F0F0F0;
      padding: 12px;

      .item-desc {
        font-size: 15px;
        color: #333333;
        line-height: 15px;
        font-weight: bold;
      }

      .item-footer {
        margin-top: 22px;
        position: relative;
        display: flex;
        align-items: center;

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-repeat: no-repeat;
          background-size: contain;
        }

        .name {
          max-width: 150px;
          margin-left: 10px;
          font-size: 14px;
          color: #999999;
        }

        .like {
          position: absolute;
          right: 0;
          display: flex;
          align-items: center;

          &.active {
            i {}

            .like-total {
              color: #ff4479;
            }
          }

          i {
            width: 28px;
            display: block;
          }

          .like-total {
            margin-left: 10px;
            font-size: 12px;
            color: #999999;
          }
        }
      }
    }
  }
}
</style>