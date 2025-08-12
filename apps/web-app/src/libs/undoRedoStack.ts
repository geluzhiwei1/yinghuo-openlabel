/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年6月26日 20:57:16
 * @date 甲辰 [龙] 年 五月廿一
 */

import { reactive } from 'vue'
import { get } from 'lodash'

export class UndoRedoOp {
  public o1: any
  public op: string = ''
  public op2: string | undefined = '' // 当前是否是undo redo操作
  public o2: any
}

export class UndoRedoStack<T> {
  private undoStack: T[] = []
  private redoStack: T[] = []
  private maxUndoCount: number

  public states = reactive({
    canRedo: false,
    canUndo: false
  })

  public getLastOp() {
    if (this.undoStack.length === 0) {
      return undefined
    }
    return this.undoStack[this.undoStack.length - 1]
  }

  // public setLastOp(op: T) {
  //     if (this.undoStack.length > 0) {
  //         this.undoStack[this.undoStack.length - 1] = op
  //     }
  // }

  constructor(maxUndoCount: number = Infinity) {
    this.maxUndoCount = maxUndoCount
  }

  do(operation: T) {
    // 如果是redo/redo引起的操作，不再记录
    if (operation.op2 === 'undo' || operation.op2 === 'redo') {
      return
    }
    if (this.undoStack.length >= this.maxUndoCount) {
      this.undoStack.shift()
    }
    this.undoStack.push(operation)
    this.redoStack = [] // 清空重做堆栈

    this.updateStates()
  }

  updateStates() {
    this.states.canRedo = this.canRedo()
    this.states.canUndo = this.canUndo()
  }

  reset() {
    this.undoStack = []
    this.redoStack = []
  }

  undo(): T | undefined {
    if (this.canUndo()) {
      const op = this.undoStack.pop()!
      this.redoStack.push(op)
      this.updateStates()
      return op
    }
    return undefined
  }

  redo(): T | undefined {
    if (this.canRedo()) {
      const op = this.redoStack.pop()!
      this.undoStack.push(op)
      this.updateStates()
      return op
    }
    return undefined
  }

  canUndo(): boolean {
    if (this.undoStack.length > 0) {
      return true
    }
    return false
  }

  canRedo(): boolean {
    if (this.redoStack.length > 0) {
      return true
    }
    return false
  }
}
