class EventBus {
  private _events: Map<string, any[]>
  public FrameSensors = {
    Preloading: 'Preloading',
    Preloaded: 'Preloaded',
    Deactivated: 'Deactivated',
    Activated: 'Activated',
    Rendering: 'Rendering',
    CurrentChanged: 'CurrentChanged', // 当前显示的帧数据发生改变
  }

  public SeqData = {
    Changed: 'SeqData-Changed',
    SeqIdChanged: 'Seq-id-Changed',
    FrameChanging: 'frame-Changing',
    FrameChanged: 'frame-Changed',
    Loaded: 'SeqData-Loaded',
    MetaLoaded: 'Seq-meta-Loaded',
  }

  public Box3d = {
    RectToolAddingBox: 'RectTool-AddingBox',
    RectToolRemovingBox: 'RectTool-RemovingBox',
    SelectedChanged: 'Selected-Changed',
    AutoLabelBoxes: 'AutoLabelBoxes',
    RemoveSeleted: 'RemoveSeleted',
    RemoveFrameAll: 'RemoveFrameAll',
    TransformEdited: 'Transform-Edited',
  }
  public PointAnnotation = {
    Commmand: 'PAE-Commmand',
    Highlight: 'PAE-Highlight'
  }

  public PolylineAnnotation = {
    Commmand: 'poly-commmand',
    Highlight: 'poly-Highlight',
    LinePointsUpdated: 'LinePointsUpdated',
    SelectedChanged: 'Line-SelectedChanged',
    ControlPointsChanged: 'Line-ControlPointsChanged',
  }

  public Common = {
    WindowResized: 'WindowResized',
    PyLibInited: 'PyLibInited',
    PointClicked: 'point-clicked'
  }

  public pcEditor = {
    Created: 'Created',
    Inited: 'Inited',
    OrbitControls: {
      Change: 'change',
    },
    TransformControls: {
      ObjectChange: 'objectChange',
      Change: 'change',
    },
    Gl: {
      Rendering: 'Rendering',
      Updated: 'Updated',
      MainViewRendered: 'MainViewRendered',
    },
    MainViewChange: 'MainViewChange',
  }

  public ToolBar = {
    Command: 'ToolBar-Command',
  }

  constructor() {
    this._events = new Map();
  }

  /**
   * 事件绑定。(注:相同的事件下的相同方法不支持多次绑定)
   * @param eventName 事件名字
   * @param callback 事件回调
   */
  public on(eventName: string, callback: (...args: any[]) => void) {
    const existEvents = this._events.get(eventName) || [];
    if (!existEvents.some((fn) => fn === callback)) {
      this._events.set(eventName, existEvents.concat(callback));
    }
  }

  /**
   * 单独的事件绑定，一个事件仅支持绑定一个函数
   *
   * @param {string} eventName
   * @param {() => void} callback
   * @memberof EventBus
   */
  public singleOn(eventName: string, callback: (...args: any[]) => void) {
    this._events.set(eventName, [callback]);
  }

  /**
   * 事件广播
   * @param eventName 事件名字
   * @param callback 事件回调
   */
  public emit(eventName: string, ...args: any[]) {
    const listener = this._events.get(eventName);
    if (listener) {
      listener.forEach((fn) => {
        if (fn) {
          fn(...args);
        }
      });
    }
  }

  /**
   * 事件解绑，对某一事件进行事件解绑
   * @param eventName 需要解绑的事件名字
   * @param callback 需要解绑的方法
   */
  public unbind(eventName: string, callback: (...args: any[]) => void) {
    const existEvents: any[] | undefined = this._events.get(eventName);
    if (existEvents) {
      this._events.set(
        eventName,
        existEvents.filter((fn: () => void) => fn !== callback),
      );
    }
  }

  /**
   * 解绑事件
   * @param eventName
   */
  public unbindAll(eventName: string) {
    this._events.delete(eventName);
  }
}

const eventBus = new EventBus()
export { eventBus }