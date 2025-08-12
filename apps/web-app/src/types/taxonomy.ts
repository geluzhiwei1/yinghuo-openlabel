// 分类体系相关类型定义

export interface TaxonomyNode {
  id: string | number
  name: string
  label: string
  children?: TaxonomyNode[]
  parent?: string | number
  metadata?: Record<string, any>
}

export interface Ontology {
  id: string
  name: string
  version: string
  classes: OntologyClass[]
  relations?: OntologyRelation[]
  metadata?: Record<string, any>
}

export interface OntologyClass {
  id: string
  name: string
  label: string
  description?: string
  parent?: string
  attributes?: ClassAttribute[]
  constraints?: ClassConstraint[]
}

export interface ClassAttribute {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'date'
  required?: boolean
  default?: any
  options?: string[] // for enum type
  description?: string
}

export interface ClassConstraint {
  type: string
  value: any
  message?: string
}

export interface OntologyRelation {
  id: string
  source: string
  target: string
  type: string
  properties?: Record<string, any>
}

export interface TaxonomyState {
  ontology: Ontology | null
  ontologyClassNames: string[] | null
  classNameToClass: Map<string, OntologyClass> | undefined
  taxonnomyInfo: any // TODO: define proper type
  annotationCategory: 'instance' | 'frame' | 'video' | null
  taxonomy: TaxonomyNode | null
  isTaxonomyLoaded: boolean
  taxonomy_id: string | null
  selectedClassId: string | number | null
  selectedClassName: string | null
  classSchemaMap: Map<string, any> | undefined
  tagAnnoMode: boolean
  seqAnnoMode: boolean
  seqAnnoSchema: { schema: any } | undefined
}
