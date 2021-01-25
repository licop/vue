/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)
// nodeOps为一些dom操作，modules为虚拟dom库的模块，用来操作属性，样式，事件等等
export const patch: Function = createPatchFunction({ nodeOps, modules })
