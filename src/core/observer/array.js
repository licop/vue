/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// 使用数组的原型创建一个新的对象
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

// 修改数组的方法，使得数组数量的变化可以被监控到
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */

methodsToPatch.forEach(function (method) {
  // cache original method
  // 保存数组的原方法
  const original = arrayProto[method]
  // def是对defineProperty的包装，重新定义修改数组的方法
  def(arrayMethods, method, function mutator (...args) {
    // 调用数组中原有的方法，返回值
    const result = original.apply(this, args)
    // 获取数组对象的__ob__
    const ob = this.__ob__
    // 数组中新增的元素
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 对插入的新元素，重新遍历数组元素为响应式数据
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 调用了修改数组的方法，调用数组的ob对象发送通知
    ob.dep.notify()
    return result
  })
})
