/* @flow */

import { mergeOptions } from '../util/index'
// 将选项merge合并
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // mergeOptions用于将两个选项合并
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
