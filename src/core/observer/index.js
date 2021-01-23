/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  // 观测对象
  value: any;
  // 依赖对象
  dep: Dep;
  // 实例计数器
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    // 初始化实例的vmCount为0
    this.vmCount = 0
    // 对defineProperty的封装，将Observer实例挂载到观察对象的__ob__属性
    def(value, '__ob__', this)
    // 数组的响应式处理
    if (Array.isArray(value)) {
      // 判断浏览器是否支持__proto__对象原型
      if (hasProto) {
        // 把数组value的__proto__原型对象指向自定义的数组原型arrayMethods
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 为数组中的每个对象创建一个observer实例
      this.observeArray(value)
    } else {
      // 如果是对象，遍历对象中的每一个属性，转换成setter/getter
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    // 获取观察对象的每一个属性
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 遍历每一个属性，设置为响应式数据
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 遍历数组 对数组中的成员进行响应式处理
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 把数组的__proto__原型对象指向自定义的数组原型
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 数据响应式入口
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果value不是对象和数组，或者是VNode的实例不需要做响应式处理
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果 value有__ob__（Observer对象）属性
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建Observer对象
    ob = new Observer(value)                                       
  }
  // 如果是跟数据
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 为一个对象定义一个响应式的属性
/**
 * 
 * @param {*} obj 
 * @param {*} key 
 * @param {*} val 
 * @param {*} customSetter 自定义setter
 * @param {*} shallow 是否是浅对象
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 创建依赖对象实例，为当前对象属性创建依赖
  const dep = new Dep()
  // 获取obj属性描述符对象
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果属性不可配置，返回
  if (property && property.configurable === false) {
    return
  }
  
  // cater for pre-defined getter/setters
  // 提供预定义的存储器函数
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 判断是否递归观察子对象，并将子对象的属性都转换为getter/setter,返回子观察对象
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 如果预定义的getter存在则value等于getter调用的返回值
      // 否则直接赋予属性值
      const value = getter ? getter.call(obj) : val
      
      // 如果存在当前依赖目标，即Watcher对象，则建立依赖
      if (Dep.target) {
        // 为属性依赖收集
        dep.depend()
        // 如果val是对象和数组的话，childOb存在，收集依赖
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 为数组的每个元素添加依赖
            dependArray(value)
          }
        }
      }
      // 返回属性值
      return value
    },
    set: function reactiveSetter (newVal) {
      // 如果预定义的getter存在则value等于getter调用的返回值
      // 否则直接赋予属性值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 如果新值等于旧值或者或者新值和旧值都是NaN则不执行， NaN 不等于 NaN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 定义setter
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 如果有getter 没有setter直接返回
      if (getter && !setter) return
      // 如果预定义setter存在则调用，否则直接更新值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 如果新值是对象，观察子对象并返回
      childOb = !shallow && observe(newVal)
      // 派发更新（发布更改通知）
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 向响应式对象中添加一个 property，并确保这个新 property 同样是响应式的，且触发视图更新
/**
 * 
 * @param {*} target 响应对象，对象或数组
 * @param {*} key 对象值或者数组索引
 * @param {*} val 值
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 不能给undefined和原始值增加属性
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 判断target是否是数组，key是否是合法的索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    // 通过splice对key位置的元素进行替换
    // splice在array.js进行了响应化的处理，可直接触发dep.notify()更新视图
    target.splice(key, 1, val)
    return val
  }
  // 如果key在对象中已经存在直接赋值
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  // 获取target中的observe对象
  const ob = (target: any).__ob__
  // 如果target是vue实例或者$data直接返回
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 如果ob对象不存在，target不是响应式对象直接赋值
  if (!ob) {
    target[key] = val
    return val
  }
  // 把key设置为响应式属性
  defineReactive(ob.value, key, val)
  // 发送通知
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
// 删除对象的 property。如果对象是响应式的，确保删除能触发更新视图。
export function del (target: Array<any> | Object, key: any) {
  // target不能是undefined和原始值
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 判断target是否是数组，key是否是合法的索引
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 删除元素
    // splice在array.js进行了响应化的处理，可直接触发dep.notify()更新视图
    target.splice(key, 1)
    return
  }
  // 获取target中的observe对象
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // 如果target没有key，直接返回
  if (!hasOwn(target, key)) {
    return
  }
  // 删除属性
  delete target[key]
  // 如果不是响应式，直接返回
  if (!ob) {
    return
  }
  // 发送通知
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
