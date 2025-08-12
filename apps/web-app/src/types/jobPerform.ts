export interface JobPerform {
  uuid: string
  id: number
  name: string
  desc: string
  data_seq: string
  domain: string
  mission: string
  taxonomy: string
  data_format: string
  data: object
  anno_hrefs: string[]
}
