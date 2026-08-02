import postal from 'postal'
import _ from 'lodash'
import { watch } from 'vue'
const channel_prefix = 'o3d:'

class _EntityChannel {
  constructor() {
    this.Events = {
      Create: 'Entity Create',
      Update: 'Entity Update',
      Delete: 'Entity Delete',
      Loaded: 'Entity Loaded',
      Modified: 'Entity Modified',
      SelectedBoxChanged: 'SelectedBoxChanged'
    }
    this.channel = postal.channel('entity')
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

class _WorldChannel {
  constructor() {
    this.Events = {
      Created: 'FrameSensors Created',
      Updated: 'FrameSensors Updated',
      Deleted: 'FrameSensors Deleted',
      Loaded: 'FrameSensors Loaded',
      Activated: 'FrameSensors Activated'
    }
    this.channel = postal.channel('world')
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

class _CameraChannel {
  constructor() {
    this.Events = {
      Show: 'Camera Show',
      Hide: 'Camera Hide',
      Changed: 'Camera Changed'
    }
    this.channel = postal.channel('Camera')
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

class _SystemSettingChannel {
  constructor() {
    this.Events = {
      ThemeChanged: 'System ThemeChanged'
    }
    this.channel = postal.channel('System-setting')
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
  constructor() {
    this.Events = {
      DataLoaded: 'Data loaded',
      PyLoaded: 'Py Loaded',
      PyAPILoaded: 'Py API',
      // ReloadUI: 'Need reload ui',
      // LabelerCreated: 'Labeler created',
      // LabelerShowed: 'Labeler showed',
      // SetMainTool: 'Set main label tool',
      EditorCreated: 'editor created',
      /**
       * 待标数据变化
       */
      SeqDataChanged: 'Seq Datachanged',
      WindowResized: 'WindowResized',
    }
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
const worldChannel = new _WorldChannel()
const cameraChannel = new _CameraChannel()
const systemSettingChannel = new _SystemSettingChannel()
const commonChannel = new _CommonChannel()

export { commonChannel, entityChannel, worldChannel, cameraChannel, systemSettingChannel }
