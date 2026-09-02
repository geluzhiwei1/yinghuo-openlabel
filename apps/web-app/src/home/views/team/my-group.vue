<template>
    <div>
        <TableSearch :query="query" :options="searchOpt" :search="handleSearch" />
        <div class="container">
            <TableCustom :columns="columns" :tableData="tableData" :total="pager.total" :page="pager.page"
                :viewFunc="handleView" :delFunc="handleDelete" :page-change="changePage" :editFunc="handleEdit" :refresh="getData">
                <template #toolbarBtn>
                    <el-button  type="primary" @click="visible = true"><Icon icon="lucide:plus-circle" />新增</el-button>
                </template>
                <template #enabled="{ rows }">
                    <el-switch v-model="rows.enabled"></el-switch>
                </template>
                <template #op="{ rows }">
                    <el-button type="primary" size="small" plain @click="emailNotify(rows)">邮件通知</el-button>
                </template>
            </TableCustom>
        </div>
        <el-dialog :title="isEdit ? '编辑' : '新增'" v-model="visible" width="700px" destroy-on-close
            :close-on-click-modal="false" @close="closeDialog">
            <el-form ref="formRef" :model="rowData" :rules="rules" label-width="100px" status-icon>
                <el-form-item label="邮箱" prop="email">
                    <el-input v-model="rowData.email" placeholder="请输入邮箱"></el-input>
                </el-form-item>
                <el-form-item label="角色" prop="roles">
                    <rolesSelect v-model:model-value="rowData.roles" ></rolesSelect>
                </el-form-item>
                <el-form-item label="部门" prop="dept">
                    <deptTreeSelect v-model:model-value="rowData.dept" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button type="primary" @click="submitForm(formRef)">
                    保存
                </el-button>
                <el-button @click="resetForm(formRef)">重置</el-button>
            </template>
        </el-dialog>
        <el-dialog title="查看详情" v-model="visible1" width="700px" destroy-on-close>
            <TableDetail :data="viewData"></TableDetail>
        </el-dialog>
    </div>
</template>

<script setup lang="ts" name="system-user">
import { Icon } from "@iconify/vue"
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { User } from "@/types/user";
import { teamApi } from "@/api";
import TableCustom from "@/components/table-custom.vue";
import TableDetail from "@/components/table-detail.vue";
import TableSearch from "@/components/table-search.vue";
import deptTreeSelect from "@/components/dept-tree-select.vue";
import rolesSelect from "@/components/roles-select.vue";
import { FormOption, FormOptionList } from "@/types/form-option";
import { validateEmail } from '@/libs/validtor'
import { formatUtc } from '@/libs/datetime'
import type { ComponentSize, FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>();
const tableLoading = ref(false)

// 查询相关
const query = reactive({
    email: undefined,
    is_registered: undefined,
    is_signed: undefined,
});
const searchOpt = ref<FormOptionList[]>([
    { type: "input", label: "email：", prop: "email" },
    {
        type: "select",
        label: "用户注册：",
        prop: "is_registered",
        opts: [
            { label: "所有", value: "" },
            { label: "已注册", value: true },
            { label: "未注册", value: false },
        ],
    },
    {
        type: "select",
        label: "用户加入：",
        prop: "is_signed",
        opts: [
            { label: "所有", value: "" },
            { label: "已加入", value: true },
            { label: "未加入", value: false },
        ],
    },
]);
const handleSearch = () => {
    pager.page = 1
    getData()
};

// 表格相关
let columns = ref([
    { type: "index", label: "序号", width: 55, align: "center" },
    { prop: "user_id", label: "ID" },
    { prop: "email", label: "邮箱账号" },
    { prop: "name", label: "姓名" },
    { prop: "mobile_number", label: "手机号" },
    { prop: "is_registered", label: "是否注册" },
    { prop: "invite_time", label: "邀请时间" },
    { prop: "is_signed", label: "是否加入" },
    { prop: "sign_time", label: "加入时间" },
    { prop: "enabled", label: "是否启用" },
    // { prop: "roles", label: "角色" },
    // { prop: "dept", label: "部门" },
    { prop: 'op', label: '' },
    { prop: "operator", label: "操作", width: 250 },
]);
const pager = reactive({
    page: 1,
    page_size: 10,
    total: 0
})
const tableData = ref<User[]>([]);
/**
 * 获取数据
 */
const buildQuery = () => {
    return {
        pager: {
            page: pager.page,
            page_size: pager.page_size
        },
        query
    }
}
const getData = async () => {
    tableLoading.value = true
    teamApi
        .search(buildQuery())
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


/**
 * 验证邮箱
 */
const checkEmail = (rule: any, value: any, callback: any) => {
    if (value === "") {
        callback(new Error("请输入邮箱"));
    } else if (!validateEmail(value)) {
        callback(new Error("请输入正确的邮箱"));
    } else {
        callback();
    }
};

// 新增/编辑弹窗相关
const rules = reactive<FormRules>({
    email: [
        { required: true, message: "请输入邮箱", trigger: "blur" },
        { validator: checkEmail, trigger: "blur" },
    ],
    roles: [
    { required: true, trigger: "blur" },
        {
            validator: (rule: any, value: any, callback: any) => {
                if (value === undefined || value.length === 0) {
                    callback(new Error("请选择至少一个角色"));
                } else {
                    callback();
                }
            }, trigger: "blur"
        }
    ],
    dept: [
    { required: true, trigger: "blur" },
        {
            validator: (rule: any, value: any, callback: any) => {
                if (value === undefined || value === "") {
                    callback(new Error("请选择部门"));
                } else {
                    callback();
                }
            }, trigger: "blur"
        }
    ]
})
const updateData = (form) => {
    if (isEdit.value) {
        teamApi.update(form).then((res) => {
            ElMessage({ message: '更新成功', type: 'success' })
            closeDialog()
            getData()
        })
    } else {
        teamApi.create(form).then((res) => {
            ElMessage({ message: '创建成功', type: 'success' })
            closeDialog()
            getData()
        })
    }
};
const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            updateData(rowData.value)
        }
    })
}

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return
    formEl.resetFields()
}
const visible = ref(false);
const isEdit = ref(false);
const rowData = ref({});
const handleEdit = (row: User) => {
    rowData.value = { ...row };
    isEdit.value = true;
    visible.value = true;
};


const closeDialog = () => {
    visible.value = false;
    isEdit.value = false;
};

// 查看详情弹窗相关
const visible1 = ref(false);
const viewData = ref({
    row: {},
    list: [],
});
const handleView = (row: User) => {
    viewData.value.row = { ...row };
    viewData.value.list = [
        {
            prop: "user_id",
            label: "ID",
        },
        {
            prop: "name",
            label: "姓名",
        },
        {
            prop: "mobile_number",
            label: "手机号",
        },
        {
            prop: "email",
            label: "邮箱账号",
        },
        {
            prop: "sign_time",
            label: "加入时间",
        },
    ];
    visible1.value = true;
};

// 删除相关
const deleteRow = (data) => {
  teamApi
    .delete(data)
    .then((res) => {
      ElMessage.success("删除成功")
      getData()
    })
}
const handleDelete = (row: User) => {
    deleteRow({ _id: row._id })
};


const emailNotify = (rows) => {
    teamApi.email_notify({id: rows['_id']}).then((res) => {
        ElMessage({ message: "发送成功", type: "success" })
    })
}

onMounted(() => {
    getData()
})
</script>

<style>
.el-form--inline .el-form-item {
    width: 220px;
}
</style>