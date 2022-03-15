import { mutableHandlers, readonlyHandlers } from "./baseHandlers"

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

function createActiveObject(origin, handlers) {
  return new Proxy(origin, handlers)
}

function isReactive(target) {
  // 如果没经过reactive, 都不会有proxy, 也不会走到判断, 会返回undefined
  // 因此用!!强制转换为boolean
  return !!target[ReactiveFlags.IS_REACTIVE]
}

function isReadonly(target) {
  return !!target[ReactiveFlags.IS_READONLY]
}

export {
  reactive,
  readonly,
  ReactiveFlags,
  isReactive,
  isReadonly,
}
