/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

//根据我们的的事件名的一些特殊标识（之前在 addHandler 的时候添加上的）区分出这个事件是否有 once、capture、passive 等修饰符。
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})
//这里定义了 invoker 方法并返回，由于一个事件可能会对应多个回调函数，所以这里做了数组的判断，多个回调函数就依次调用。
export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns//一次执行 invoker 函数都是从 invoker.fns 里取执行的回调函数
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  invoker.fns = fns
  return invoker
}
//遍历 on 去添加事件监听，遍历 oldOn 去移除事件监听，关于监听和移除事件的方法都是外部传入的，因为它既处理原生 DOM 事件的添加删除，也处理自定义事件的添加删除。
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    def = cur = on[name]//遍历 on 去添加事件监听
    old = oldOn[name]//遍历 oldOn 去移除事件监听
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)//完成一次事件绑定
    } else if (cur !== old) {//当我们第二次执行该函数的时候，判断如果 cur !== old，那么只需要更改 old.fns = cur 把之前绑定的 involer.fns 赋值为新的回调函数即可
      old.fns = cur
      on[name] = old//通过 on[name] = old 保留引用关系，这样就保证了事件回调只添加一次，之后仅仅去修改它的回调函数的引用
    }
  }
  for (name in oldOn) {//遍历 oldOn 拿到事件名称
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)//移除事件回调
    }
  }
}
