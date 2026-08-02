<template>
  <div class="main" ref="mainRef"
  :style="{ top: '0px', 
  left: '0px',
   }">
    <ThreeScene
      v-show="size.width && size.height && (curWindow === 'x' || isSplit)"
      direction="x"
      v-model:infoVisible="showInfo.x"
      v-model:max="xMax"
      :position="position.x"
      v-model:value="position.x"
      :width="size.width"
      :height="size.height"
    >
      <ToolBar
        color="red"
        :min="1"
        :max="xMax"
        v-model:infoVisible="showInfo.x"
        v-model:value="position.x"
        :sliderVisible="true"
        @info="onInfo($event, 'x')"
        @change="onChange($event, 'x')"
        @resize="onWindowResize($event, 'x')"
      />
    </ThreeScene>
    <ThreeScene
      v-show="size.width && size.height && (curWindow === 'main' || isSplit)"
      direction="main"
      v-model:value="position.main"
      v-model:infoVisible="showInfo.main"
      :status="status"
      :operation="operation"
      :guide="guide"
      :scaleVisible="scaleVisible"
      :max="1000"
      :position="position.main"
      :width="size.width"
      :height="size.height"
      :navDirection="navDirection"
      :sceneColor="sceneColor"
      @change="onChange($event, 'main')"
    >
      <ToolBar
        color="#ccc"
        :min="1"
        :max="1000"
        v-model:setVisible="setVisible"
        v-model:infoVisible="showInfo.main"
        v-model:value="position.main"
        :sliderVisible="false"
        @info="onInfo($event, 'main')"
        @resize="onWindowResize($event, 'main')"
      />
      <Panel v-if="setVisible">
        <div class="main-contain">
          <div class="main-dirction">
            <div class="btn A" @click="onDirection('A')"></div>
            <div class="btn P" @click="onDirection('P')"></div>
            <div class="btn R" @click="onDirection('R')"></div>
            <div class="btn L" @click="onDirection('L')"></div>
            <div class="btn S" @click="onDirection('S')"></div>
            <div class="btn I" @click="onDirection('I')"></div>
          </div>
          <div class="main-btns">
            <Icon icon="lucide:zoom-out" @click="onZoomOut" />
            <Icon icon="lucide:zoom-in" @click="onZoomIn" />
            <Icon icon="lucide:scaling"
              @click="scaleVisible = !scaleVisible"
              :class="{ active: scaleVisible }"
            />
            <Icon icon="lucide:timer" @click="status = !status" :class="{ active: status }" />
            <Icon icon="lucide:compass" @click="guide = !guide" :class="{ active: guide }" />
            <Icon icon="lucide:sliders-horizontal"
              @click="operation = !operation"
              :class="{ active: operation }"
            />
            <el-color-picker
              v-model="sceneColor"
              @active-change="onChangeColor"
            />
          </div>
        </div>
      </Panel>
    </ThreeScene>

    <ThreeScene
      direction="y"
      :infoVisible="showInfo.y"
      :position="position.y"
      v-model:max="yMax"
      v-model:value="position.y"
      :width="size.width"
      :height="size.height"
      v-show="size.width && size.height && (curWindow === 'y' || isSplit)"
    >
      <ToolBar
        color="green"
        :min="1"
        :max="yMax"
        :infoVisible="showInfo.y"
        v-model:value="position.y"
        :sliderVisible="true"
        @info="onInfo($event, 'y')"
        @change="onChange($event, 'y')"
        @resize="onWindowResize($event, 'y')"
      />
    </ThreeScene>
    <ThreeScene
      direction="z"
      :position="position.z"
      v-model:max="zMax"
      v-model:infoVisible="showInfo.z"
      v-model:value="position.z"
      :width="size.width"
      :height="size.height"
      v-show="size.width && size.height && (curWindow === 'z' || isSplit)"
    >
      <ToolBar
        color="blue"
        :min="1"
        :max="zMax"
        v-model:infoVisible="showInfo.z"
        v-model:value="position.z"
        :sliderVisible="true"
        @info="onInfo($event, 'z')"
        @change="onChange($event, 'z')"
        @resize="onWindowResize($event, 'z')"
      />
    </ThreeScene>
  </div>
</template>

<script setup>
import { reactive, ref, onBeforeUnmount, onMounted, watch } from "vue";
import { useDark } from "@vueuse/core";
import { Icon } from "@iconify/vue";
import ThreeScene from "./components/ThreeScene.vue";
import ToolBar from "./components/ToolBar.vue";
import Panel from "./components/Panel.vue";
import { uiState, topBar, attrPanel, mainPanel, appContainer, canvaPanel, dataPanel, userViewLayout } from '@/states/UiState'

const isDark = useDark()

const mainRef = ref(null);
const size = ref({ width: 0, height: 0 });
const isSplit = ref(true);
const curWindow = ref("");
const showInfo = reactive({ x: true, y: true, z: true, main: true });
const position = reactive({
  x: 120,
  y: 120,
  z: 120,
  main: {
    x: 200,
    y: 200,
    z: 200,
  },
});
const xMax = ref(240);
const yMax = ref(240);
const zMax = ref(240);
const status = ref(true);
const operation = ref(false);
const guide = ref(false);
const scaleVisible = ref(false);
const setVisible = ref(false);
const navDirection = ref("");
const sceneColor = ref(isDark.value ? "#000" : "#f5f5f5");
//#endregion 变量定义

//#region 生命周期
// onMounted(() => {
//   window.addEventListener("resize", onResize);
//   onResize();
// });

onBeforeUnmount(() => {});
//#endregion 生命周期
//#region Function
const onChange = (v, type) => {
  position[type] = Number(v);
};

const onInfo = (v, type) => {
  showInfo[type] = v;
};
const onWindowResize = (isFull, type) => {
  curWindow.value = type;
  isSplit.value = !isFull;
  onResize();
};
const onResize = () => {
  if (isSplit.value) {
    size.value.width = canvaPanel.width_px  / 2 - 2;
    size.value.height = canvaPanel.height_px / 2 - 2;
  } else {
    size.value.width = canvaPanel.width_px;
    size.value.height = canvaPanel.height_px
  }
};

const onZoomOut = () => {
  let normal = 1;
  if (["L", "I", "P"].includes(navDirection.value)) {
    normal = -1;
  }
  position.main.x =
    position.main.x === 0 ? 0 : Number(position.main.x) + 10 * normal;
  position.main.y =
    position.main.y === 0 ? 0 : Number(position.main.y) + 10 * normal;
  position.main.z =
    position.main.z === 0 ? 0 : Number(position.main.z) + 10 * normal;
};
const onZoomIn = () => {
  let normal = 1;
  if (["L", "I", "P"].includes(navDirection.value)) {
    normal = -1;
  }
  position.main.x =
    position.main.x === 0 ? 0 : Number(position.main.x) - 10 * normal;
  position.main.y =
    position.main.y === 0 ? 0 : Number(position.main.y) - 10 * normal;
  position.main.z =
    position.main.z === 0 ? 0 : Number(position.main.z) - 10 * normal;
};

const onDirection = (type) => {
  navDirection.value = type;
};
const onChangeColor = (v) => {
  sceneColor.value = v;
};

onMounted(() => {
  watch(() => uiState.id, () => {
    onResize()
  })
  watch(isDark, (dark) => {
    sceneColor.value = dark ? "#000" : "#f5f5f5"
  })
});

//#endregion Function
</script>

<style scoped lang="less">
.main {
  position: absolute;
  // left: var(--aside-width);
  // top: var(--header-height);
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  height: 100%;
  // width: calc(100vw - var(--aside-width));
  // height: calc(100vh - var(--header-height));
}

.main-contain {
  display: flex;
  flex-direction: row;
  background: aliceblue;
  height: 132px;
  width: 200px;

  .main-dirction {
    min-width: 130px;
    height: 132px;
    background-image: url(./assets/images/guid.jpg);
    background-size: cover;
    background-repeat: no-repeat;
    position: relative;

    .btn {
      position: absolute;
      // background-color: red;
      width: 25px;
      height: 25px;
    }

    .A {
      bottom: 10px;
      right: 10px;
    }

    .P {
      top: 20px;
      left: 20px;
    }

    .R {
      top: 50%;
      left: 5px;
      transform: translate(0, -50%);
    }

    .L {
      top: 50%;
      right: 5px;
      transform: translate(0, -50%);
    }

    .S {
      left: 50%;
      top: 5px;
      transform: translate(-50%, 0);
    }

    .I {
      left: 50%;
      bottom: 5px;
      transform: translate(-50%, 0);
    }
  }

  .main-btns {
    display: flex;
    flex-wrap: wrap;

    // align-items: flex-start;
    // justify-content: flex-start;
    svg {
      width: 30px;
      height: 30px;
      cursor: pointer;

      &:hover {
        color: var(--y-color-primary);
      }
    }
  }

  .active {
    color: var(--y-color-primary);
  }
}
</style>
