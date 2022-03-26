import { mutableHandlers, readonlyHandlers, shallowReadonlyHandlers } from "./baseHandlers"

const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly"
}

function reactive(origin: any) {
  return createActiveObject(origin, mutableHandlers)
}

function readonly(origin) {
  return createActiveObject(origin, readonlyHandlers)
}

function shallowReadonly(origin) {
  return createActiveObject(origin, shallowReadonlyHandlers)
}

function createActiveObject(origin, handlers) {
  return new Proxy(origin, handlers)
}

// isReactive和isReadonly通过传入特定的key到getter中判断
function isReactive(target) {
  // 如果没经过reactive, 都不会有proxy, 也不会走到判断, 会返回undefined
  // 因此用!!强制转换为boolean
  return !!target[ReactiveFlags.IS_REACTIVE]
}

function isReadonly(target) {
  return !!target[ReactiveFlags.IS_READONLY]
}

function isProxy(target) { 
  return !!target[ReactiveFlags.IS_REACTIVE] || !!target[ReactiveFlags.IS_READONLY]
}

export {
  reactive,
  readonly,
  shallowReadonly,
  ReactiveFlags,
  isReactive,
  isReadonly,
  isProxy
}
