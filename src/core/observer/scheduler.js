/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  // 标记正在处理watcher队列
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 1. 父组件在子组件之前执行，因为父组件在子组件之前创建
  // 2. 用户watcher在渲染watcher之前执行，因为用户watcher是在initState里创建的，mountCompoent里创建渲染watcher
  // 3. 如果一个组件在父组件watcher执行时被销毁，则这个组件的watcher应该跳过
  // 按照watcher的创建顺序排列
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 遍历所有watcher，不要缓存length，因为当我们运行存在的watcher的时候，可能会添加新的watcher
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // beforeUpdate钩子函数
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    // 运行watcher
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  // 触发activated和updated钩子函数
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
//  wachter存入watcher队列
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  // has为一个对象，用来标记当前watcher是否被处理过
  // 如果同一个 watcher 被多次触发，只会被推入到队列中一次。
  if (has[id] == null) {
    has[id] = true
    // flushing 为true说明当前queue正在被处理
    // flushing 为false把当前watcher放到queue末尾
    // 这种在缓冲时去除重复数据对于避免不必要的计算和 DOM 操作是非常重要的
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // 
      let i = queue.length - 1
      // index正在处理当前队列的第几个元素， i>index说明还没被处理完
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      // 把watcher放在当前队列里
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 当前队列是否被执行
    if (!waiting) {
      waiting = true
      // 开发环境通过配置async 可以直接调用flushSchedulerQueue()，同步更新视图
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        // 遍历所有watcher执行run方法
        flushSchedulerQueue()
        return
      }
      // 在下一个的事件循环“tick”中，Vue 刷新队列并执行实际 (已去重的) 工作, 异步更新视图
      nextTick(flushSchedulerQueue)
    }
  }
}
