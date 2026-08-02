<template>
    <div>
        <div class="container">
            <TableCustom :columns="columns" :tableData="tableData" :refresh="getData" :hasPagination="false">
                <template #op="{ rows }">
                    <el-button type="primary" size="small" :disabled="!rows.agreement?.is_signed" plain @click="teamAgree(rows)">退出</el-button>
                    <el-button type="primary" size="small" :disabled="rows.agreement?.is_signed" plain @click="teamAgree(rows)">加入</el-button>
                </template>
            </TableCustom>
        </div>
    </div>
</template>

<script setup lang="ts" name="system-user">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { User } from "@/types/user";
import { teamApi } from "@/api";
import TableCustom from "@/components/table-custom.vue";

import { FormOption, FormOptionList } from "@/types/form-option";
import { validateEmail } from '@/libs/validtor'
import { formatUtc } from '@/libs/datetime'
import type { ComponentSize, FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>();
const tableLoading = ref(false)

// 表格相关
let columns = ref([
    { type: "index", label: "序号", width: 55, align: "center" },
    { prop: "main_id", label: "团队ID" },
    { prop: "main_email", label: "团队邮箱" },
    // { prop: "user_id", label: "ID" },
    // { prop: "email", label: "邮箱账号" },
    // { prop: "name", label: "姓名" },
    // { prop: "mobile_number", label: "手机号" },
    { prop: "invite_time", label: "邀请时间" },
    { prop: "is_signed", label: "是否加入" },
    { prop: "sign_time", label: "加入时间" },
    // { prop: "roles", label: "角色" },
    // { prop: "dept", label: "部门" },
    { prop: 'op', label: '操作' },
]);
const pager = reactive({
    page: 1,
    page_size: 10,
    total: 0
})
const tableData = ref<User[]>([]);

const getData = async () => {
    tableLoading.value = true
    teamApi
        .query_others()
        .then((res) => {
            tableData.value = res.data.map((item) => {
                return {
                    ...item,
                    invite_time: formatUtc(item.invitation?.invite_time),
                    is_signed: item.agreement?.is_signed,
                    sign_time: formatUtc(item.agreement?.sign_time),
                    // spec: item.spec && item.spec != '' ? JSON.parse(item.spec) : ""
                }
            })
            pager.total = res.total
            pager.page_size = res.page_size
            pager.page = res.page
        })
        .finally(() => {
            tableLoading.value = false
        })
};

const changePage = (val: number) => {
    pager.page = val
    getData()
}

const teamAgree = (rows) => {
    teamApi.sign({id: rows['_id'], is_signed: true}).then((res) => {
        ElMessage({ message: "操作成功", type: "success" })
    })
}

onMounted(() => {
    getData()
})
</script>
