import postal from 'postal'
import _ from 'lodash'

const channel_prefix = 'img:'

class _EntityChannel {
  public Events
  public channel
  constructor() {
    this.Events = {
      Create: 'Entity Create',
      CreateBySAM: 'Entity CreateBySAM',
      RequestSAM: 'RequestSAM',
      Updated: 'Entity Updated',
      Delete: 'Entity Delete',
      Loaded: 'Entity Loaded',
      Modified: 'Entity Modified',
      DefaultClassChanged: 'Default Entity Class Changed',
      SelectedBoxChanged: 'SelectedBoxChanged',
      SaveComand: 'Save Comand',
    }
    this.channel = postal.channel(channel_prefix + 'entity')
  }

  sub(event, callback) {
    // logger.debug(`subscribe ${event}`)
    this.channel.subscribe(event, callback)
  }

  pub(event, msg) {
    _.set(msg, 'event', event)
    // logger.debug(msg)
    this.channel.publish(event, msg)
  }
}

class _CommonChannel {
  Events = {
    // DataLoaded: 'Data loaded from server',
    ReloadUI: 'try to reload ui',
    // LabelerCreated: 'Labeler created',
    // LabelerShowed: 'Labeler showed',
    // SetMainTool: 'Set main label tool',
    // MissonChanged: 'Label mission changed',
    /**
     * 待标数据变化
     */
    // SeqDataChanged: 'Seq Datachanged',
    /***
     * Common button
     */
    ButtonClicked: 'Button Clicked',

    UiImageWaterFall: 'imageWaterfall',

    /**
     * 请求改变当前帧
     */
    ChangingFrame: 'changing frame',

    /**
     * 图片加载结束
     */
    ImageLoaded: 'image loaded',
    VideoLoaded: 'video loaded',

    /**
     * anno加载结束
     */
    // AnnoLoaded: 'anno loaded',

    UpdateObjectCounts: 'update object counts',
  }

  constructor() {
    this.channel = postal.channel(channel_prefix + 'common')
  }

  sub(event, callback) {
    // logger.debug(`subscribe ${event}`)
    return this.channel.subscribe(event, callback)
  }

  pub(event, msg) {
    _.set(msg, 'event', event)
    // logger.debug(msg)
    this.channel.publish(event, msg)
  }
}

const entityChannel = new _EntityChannel()
const commonChannel = new _CommonChannel()


export { entityChannel, commonChannel }
