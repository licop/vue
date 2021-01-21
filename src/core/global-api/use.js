/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 所有的插件集合
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 判断是否已经注册了插件
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // toArray方法把参数转换为数组，并截取索引1以后的元素
    const args = toArray(arguments, 1)
    // 把this(Vue)插入到第一个元素的位置, 使得插件可以获取Vue
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 插件存储到数组
    installedPlugins.push(plugin)
    return this
  }
}
