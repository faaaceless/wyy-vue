import { track, trigger } from "./effect"
import { reactive, ReactiveFlags, readonly } from "./reactive"
import { isObject } from "./utils"

// 优化: 反复调用的情况
const get = createGetter(),
  set = createSetter(),
  readonlyGet = createGetter(true),
  shallowReadonlyGet = createGetter(true, true)


function createGetter(isReadonly = false, shallow = false) {
  return function getter(target, key, receiver) {
    // 用于isReactive
    if (key === ReactiveFlags.IS_REACTIVE) return !isReadonly
    // 用于isReadonly
    if (key === ReactiveFlags.IS_READONLY) return isReadonly

    const res = Reflect.get(target, key, receiver)

    // nested不作为响应对象
    if (shallow) return res

    // nested reactive和readonly, 也就是get的时候转换成proxy
    if (isObject(res)) return isReadonly ? readonly(res) : reactive(res)

    // 收集依赖
    if (!isReadonly) track(target, key)
    return res
  }
}

function createSetter() {
  return function setter(target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver)
    // 触发依赖
    trigger(target, key)
    return res
  }
}

const mutableHandlers = {
  get,
  set
}

const readonlyHandlers = {
  readonlyGet,
  set(target, key, value, receiver) {
    console.warn(`Set operation on key "${key}" failed: target is readonly.`)
    return true
  }
}

const shallowReadonlyHandlers = Object.assign({}, readonlyHandlers, { get: shallowReadonlyGet })

export {
  mutableHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers
}