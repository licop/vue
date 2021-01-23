/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }
  // 添加依赖
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
  // 移除依赖
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      // 如果Dep.target存在，则把dep对象添加到watcher的依赖中
      // 同事addDep调用dep.addSub将Wachter实例添加到subs
      Dep.target.addDep(this)
    }
  }
  // 发布通知
  notify () {
    // stabilize the subscriber list first
    // 对数组进行克隆
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 按照watcher的创建顺序排序
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      // 调用每个订阅这的update方法实现更新
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// Dep.target用来存放正在使用的watcher
// 全局唯一，并且一次只能有一个watcher被使用
Dep.target = null
const targetStack = []
// 入栈，并将当前watcher赋值给Dep.target
// 父子组件嵌套的时候先把父组件对应的watcher入栈
// 再去处理子组件的watcher，子组件处理完毕，再把父组件对应的watcher出栈，继续操作
export function pushTarget (target: ?Watcher) {
  // 每个组件对应一个watcher对象
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  // 出栈操作
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
