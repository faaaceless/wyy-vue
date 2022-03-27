import { mutableHandlers, readonlyHandlers, shallowMutableHandlers, shallowReadonlyHandlers } from "./baseHandlers"

const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow"
}

function reactive(origin: any) {
  return createActiveObject(origin, mutableHandlers)
}

function readonly(origin) {
  return createActiveObject(origin, readonlyHandlers)
}

function shallowReactive(origin) {
  return createActiveObject(origin, shallowMutableHandlers)
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

function isShallow(target) {
  return !!target[ReactiveFlags.IS_SHALLOW]
}

// TODO: toRaw
function toRaw() {

}

// TODO:markRaw
function markRaw() {

}

export {
  reactive,
  readonly,
  shallowReadonly,
  shallowReactive,
  ReactiveFlags,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  toRaw,
  markRaw
}
