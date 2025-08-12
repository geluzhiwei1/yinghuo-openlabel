/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年9月25日
 * @date 甲辰 [龙] 年 八月廿三
 */

const defaultTemplate = {
  openlabel: {
    meta: {
      name: '标准规范1',
      description: '标准规范1的简要说明'
    },
    classes: [
      {
        name: 'root',
        description: '最顶层元素，必须存在。包括所有类别通用的属性定义',
        properties: {
          tags: {
            type: 'string',
            title: 'Tags',
            default: '',
            maxLength: 1024
          },
          desc: {
            type: 'string',
            default: '',
            title: '描述',
            maxLength: 1024
          }
        },
        children: [
          {
            name: '类别1',
            properties: {},
            children: [
              {
                name: '类别1.1',
                properties: {
                  字符属性: {
                    type: 'string',
                    default: '',
                    title: 'skis专属字段',
                    maxLength: 1024,
                    minLength: 10
                  },
                  数值属性: {
                    type: 'integer',
                    title: '输入年龄',
                    maximum: 80,
                    minimum: 16
                  },
                  color: {
                    type: 'string',
                    title: '颜色',
                    description: '信号灯当前颜色',
                    enum: ['绿色', '红色', '黄色', '黑色'],
                    default: '黑色',
                    'ui:widget': 'RadioWidget'
                  },
                  count: {
                    type: 'number',
                    title: '数字',
                    description: '信号灯数字',
                    default: -1,
                    minimum: -1,
                    maximum: 300,
                    'ui:options': {
                      precision: 0
                    }
                  },
                  door_status: {
                    type: 'array',
                    title: '车门状态',
                    description: '车门/后备箱/火车后门开启情况',
                    items: {
                      type: 'string',
                      enum: ['关闭', '左侧门开', '右侧门开', '后门开', '后备箱开'],
                      enumNames: ['关闭', '左侧门开', '右侧门开', '后门开', '后备箱开']
                    },
                    default: [],
                    uniqueItems: true,
                    'ui:widget': 'CheckboxesWidget'
                  }
                }
              },
              {
                name: '类别1.2',
                properties: {}
              },
              {
                name: '类别1.3',
                properties: {},
                children: [
                  {
                    name: '行人',
                    definition: {
                      description: 'Pedestrian步行的人，包括推婴儿车、拉行李箱、推轮椅等'
                    },
                    properties: {
                      driving_status: {
                        type: 'string',
                        title: '状态',
                        description: '状态',
                        enum: ['静止', '运动'],
                        minLength: 1,
                        default: 'unlabeled',
                        'ui:widget': 'RadioWidget'
                      }
                    }
                  },
                  {
                    name: '动物',
                    definition: {
                      description: '牛马羊猫狗等各类动物'
                    }
                  }
                ]
              }
            ]
          },
          {
            name: '类别2',
            properties: {},
            children: [
              {
                name: '类别2.1',
                properties: {}
              },
              {
                name: '类别2.2',
                properties: {}
              },
              {
                name: '类别2.3',
                properties: {}
              }
            ]
          }
        ]
      }
    ]
  }
}

const simpleTemplate = {
  openlabel: {
    meta: {
      name: '标准规范1',
      description: '标准规范1的简要说明'
    },
    classes: [
      {
        name: 'root',
        description: '最顶层元素，必须存在。包括所有类别通用的属性定义',
        properties: {
          tags: {
            type: 'string',
            title: 'Tags',
            default: '',
            maxLength: 1024
          },
          desc: {
            type: 'string',
            default: '',
            title: '描述',
            maxLength: 1024
          }
        },
        children: [
          {
            name: '类别1',
            properties: {}
          },
          {
            name: '类别2',
            properties: {}
          }
        ]
      }
    ]
  }
}

export const annoSpecTemplates = {
  default: defaultTemplate,
  simple: simpleTemplate,
  data: [
    { name: 'default', spec: defaultTemplate },
    { name: 'simple', spec: simpleTemplate }
  ]
}
