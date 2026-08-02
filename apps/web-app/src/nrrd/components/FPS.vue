<template>
 <div class="fps">
    {{ `FPS:${fps}` }}
 </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const fps=ref(0)
onMounted(() => {
    const  rAF =   (() =>{
    return (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        }
    );
})();
  
let frame = 0;
let allFrameCount = 0;
let lastTime = Date.now();
 let lastFameTime = Date.now();
  
const loop = function () {
    const now = Date.now();
    const fs = (now - lastFameTime);
    fps.value= Math.round(1000 / fs);
  
    lastFameTime = now;
    // 不置 0，在动画的开头及结尾记录此值的差值算出 FPS
    allFrameCount++;
    frame++;
  
    if (now > 1000 + lastTime) {
         fps.value = Math.round((frame * 1000) / (now - lastTime));
        console.log(`${new Date()} 1S内 FPS：`, fps.value);
        frame = 0;
        lastTime = now;
    }; 
    rAF(loop);
} 
loop();
})
</script>

<style scoped lang="less">
.fps{
    position: absolute;
    color: var(--y-color-canvas-text-muted);
    bottom: 20px;
    right: 20px;
}
</style>
