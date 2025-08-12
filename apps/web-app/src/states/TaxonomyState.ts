import { reactive, watch } from 'vue'
import { taxonomyApi, openlabelApi, annoSpecApi } from '@/api'
import { cloneDeep, get, set } from '@/utils/lodash'
import { jobConfig } from './job-config'
import { ElMessage } from 'element-plus'
import { Mission } from '../constants'

const taxonomyState = reactive({
  ontologyClassNames: null,
  classNameToClass: undefined as Map<string, Object> | undefined,
  ontology: null,
  taxonnomyInfo: {
    meta: null,
    ontologies: []
  },
  /**
   * 整个序列的标注schema
   */
  seqAnnoSchema: undefined as { schema: any } | undefined
})

const buildClassSchemaMap = (cla: any, map: Map<string, any>) => {
  // map[cla.name] = cla
  map.set(cla.name, cla)
  if (cla.children) {
    for (const child of cla.children) {
      buildClassSchemaMap(child, map)
    }
  }
}

async function getOntology(mission: any) {
  const params = { mission: mission }
  const data: any = await taxonomyApi.schema(params)
  if (!data || !data.openlabel || !data.openlabel.classes || data.openlabel.classes.length === 0) {
    return
  }
  const cla = data.openlabel.classes[0]
  switch (mission) {
    case Mission.ObjectDet2d:
    case Mission.Semantic2d:
      if ('TrafficParticipantByParticipantType' == cla.name) {
        // ontology.value = cla.children
        taxonomyState.ontology = cla.children
      } else if ('RoadTopologyAndTrafficInfrastructure' == cla.name) {
        // ontology.value = cla.children
        taxonomyState.ontology = cla.children
      }
      break
    case Mission.TrafficSignal2d:
      // ontology.value = cla.children
      taxonomyState.ontology = cla.children
      break
  }

  // build classNameToClass
  const tmp_map = new Map()
  for (const cla of data.openlabel.classes) {
    buildClassSchemaMap(cla, tmp_map)
  }
  taxonomyState.classNameToClass = tmp_map
}

async function getOntologyClassNames(mission) {
  const { key, type, name, domain } = jobConfig.taxonomy
  if (type === 'system') {
    const res = await openlabelApi.classes()
    taxonomyState.ontologyClassNames = res.data
    // return data
  } else {
    const res = await annoSpecApi.classes({ _id: key })
    taxonomyState.ontologyClassNames = res.data
    // return data
  }
}

watch(
  () => jobConfig.mission,
  async (newVal, oldVal) => {
    if (newVal === oldVal || newVal === undefined || newVal === '') {
      return
    }
    await Promise.all([
      // getOntology(newVal),
      getOntologyClassNames(newVal)
    ])
  }
)

const parseAnnoSpec = (data) => {
  if (!data || !data.openlabel || !data.openlabel.classes || data.openlabel.classes.length === 0) {
    return
  }
  // info
  taxonomyState.taxonnomyInfo.meta = data.openlabel.meta
  taxonomyState.taxonnomyInfo.ontologies = get(data, 'openlabel.ontologies', [])

  // get ontology
  const cla = data.openlabel.classes[0]
  taxonomyState.ontology = cla.children

  // build classNameToClass
  const tmp_map = new Map()
  buildClassSchemaMap(data.openlabel.classes[0], tmp_map)
  taxonomyState.classNameToClass = tmp_map

  if (data.openlabel.classes.length > 1) taxonomyState.seqAnnoSchema = data.openlabel.classes[1]
}

const loadSpec = () => {
  const { key, type, name, domain } = jobConfig.taxonomy
  if (type === 'system') {
    openlabelApi.query({ taxonomy: jobConfig.taxonomy, domain }).then((res) => {
      if (res.data && res.data.length === 1) {
        const data = res.data[0]
        parseAnnoSpec(data)
      } else {
        ElMessage.error('获取系统【标注规范】失败')
      }
    })
  } else if (type === 'user') {
    annoSpecApi.query({ _id: key }).then((res) => {
      if (res.data && res.data.length === 1) {
        const data = res.data[0].spec
        parseAnnoSpec(data)
      } else {
        ElMessage.error('获取自定义的【标注规范】失败')
      }
    })
  }
}

watch(
  () => jobConfig.taxonomy,
  (newVal, oldVal) => {
    if (newVal === oldVal) {
      return
    }
    loadSpec()
  }
)

// watch([() => taxonomyState.ontology, () => taxonomyState.ontologyClassNames], (newVal, oldVal) => {
//   if (newVal[0] && newVal[1]) {
//     mainAnnoStates.defaultObjType = 'default'
//   }
// })

// watch(
//   () => taxonomyState.ontologyClassNames,
//   (newVal, oldVal) => {
//     mainAnnoStates.setting.objectTypes = newVal
//     mainAnnoStates.setting.objectTypes.unshift('_ol_default')
//     mainAnnoStates.setting.objectTypes.unshift('_ol_selected')
//   }
// )

export { taxonomyState, loadSpec, getOntologyClassNames }