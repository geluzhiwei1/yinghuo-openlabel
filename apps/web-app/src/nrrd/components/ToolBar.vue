<template>
  <div class="tool-bar" :style="{ 'background-color': color }">
    <Icon v-if="!isFull" icon="lucide:maximize" title="全屏" class="btn" @click="onFull" />
    <Icon v-else icon="lucide:minimize" title="退出全屏" class="btn" @click="onExitFull" />
    <Icon icon="lucide:info"
      class="btn"
      title="详细"
      :class="{ active: infoVisible }"
      @click="onInfo"
    />
    <Icon icon="lucide:settings"
      v-if="sliderVisible !== true"
      class="btn"
      :class="{ active: setVisible }"
      title="重置"
      @click="onSet"
    />
    <div class="slider" v-if="sliderVisible === true">
      <Icon icon="lucide:rotate-ccw" class="btn" title="重置" @click="onRedo" />
      <el-slider
        v-model="silderValue"
        :step="1"
        :show-tooltip="false"
        @change="onSliderChange"
        :max="max || 100"
        :min="min || 0"
      />
      <div class="slider-value">{{ silderValue }}</div>
    </div>
  </div>
</template>

<script setup>
import {
  reactive,
  ref,
  unref,
  onBeforeMount,
  onBeforeUnmount,
  watch,
} from "vue";
import { Icon } from "@iconify/vue";
//#region 变量定义
const props = defineProps([
  "color",
  "min",
  "max",
  "sliderVisible",
  "value",
  "infoVisible",
  "setVisible",
]);
const emits = defineEmits([
  "change",
  "reset",
  "resize",
  "update:value",
  "update:infoVisible",
  "update:setVisible",
]);
const isFull = ref(false);
const silderValue = ref(props.value);

const defaultValue = unref(props.value);

//#endregion 变量定义

watch(
  () => props.value,
  () => {
    silderValue.value = props.value;
  }
);

//#region 生命周期
onBeforeMount(() => {});

onBeforeUnmount(() => {});
//#endregion 生命周期
//#region Function
const onFull = () => {
  isFull.value = true;
  emits("resize", isFull.value);
};
const onExitFull = () => {
  isFull.value = false;
  emits("resize", isFull.value);
};
const onRedo = () => {
  silderValue.value = defaultValue;
  emits("update:value", defaultValue);
};
const onInfo = () => {
  emits("update:infoVisible", !props.infoVisible);
};
const onSliderChange = (v) => {
  emits("update:value", v);
};
const onSet = () => {
  emits("update:setVisible", !props.setVisible);
};
//#endregion Function
</script>

<style scoped lang="less">
.tool-bar {
  position: absolute;
  top: 0px;
  left: 0px;
  height: 30px;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.btn {
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: var(--y-color-canvas-text);
  margin-left: 5px;

  &:hover {
    color: var(--y-color-canvas-active);
  }
}

.active {
  color: var(--y-color-canvas-active);
}

.slider {
  width: 85%;
  height: 30px;
  display: flex;
  align-items: center;

  & > svg {
    margin-right: 15px;
    width: 20px;
    height: 20px;
  }

  &-value {
    margin-left: 10px;
    height: 30px;
    line-height: 30px;
    color: var(--y-color-canvas-text);
  }
}
</style>
