import { ShapeFlags } from "./ShapeFlags"

// 给renderSlots用的
export const Fragment = Symbol("Fragment")
export const Text = Symbol("Text")

// shapeFlags指示自己是组件还是元素， 
// 以及children是text节点还是array
export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    children,
    shapeFlag: getShapeFlag(type),
    el: null
  }

  if (typeof children === 'string') {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN
  }

  // 使用插槽时, children是object, key就是具名插槽的名字
  if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT && typeof children === 'object') {
    vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN
  }

  return vnode
}

export function createTextVNode(text: string) {
  return createVNode(Text, {}, text)
}

function getShapeFlag(type) {
  return typeof type === 'string' ? ShapeFlags.ELEMENT : ShapeFlags.STATEFUL_COMPONENT
}