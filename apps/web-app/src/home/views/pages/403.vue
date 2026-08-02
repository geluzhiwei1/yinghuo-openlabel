<template>
    <div class="error-page">
        <div class="error-box">
            <div class="error-code">403</div>
            <div class="error-desc">没有权限访问该页面</div>
            <div class="error-handle">
                <router-link to="/">
                    <el-button type="primary" size="large">返回首页</el-button>
                </router-link>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" name="403">
import { useRouter } from 'vue-router';

const router = useRouter();
const goBack = () => {
    router.go(-2);
};
</script>

<style scoped>
.error-page {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    background: var(--y-color-bg-canvas);
    box-sizing: border-box;
}

.error-box {
    width: 400px;
    background-color: var(--y-color-bg-card);
    padding: 80px 50px;
    border-radius: var(--y-radius-lg);
    border: 1px solid var(--y-color-border);
}

.error-code {
    line-height: 1;
    font-size: 100px;
    font-weight: var(--y-font-weight-bold);
    color: var(--y-color-primary);
    margin-bottom: 20px;
    text-align: center;
}

.error-desc {
    font-size: var(--y-font-size-xl);
    color: var(--y-color-text-secondary);
    text-align: center;
}

.error-handle {
    margin-top: 50px;
    text-align: center;
}

.error-btn {
    margin-left: 100px;
}
</style>
