import { ShapeFlags } from "./ShapeFlags"

// shapeFlags指示自己是组件还是元素， 
// 以及children是text节点还是array
export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    children,
    shapeFlags: getShapeFlag(type),
    el: null
  }

  if (typeof children === 'string') {
    vnode.shapeFlags |= ShapeFlags.TEXT_CHILDREN
  } else if (Array.isArray(children)) {
    vnode.shapeFlags |= ShapeFlags.ARRAY_CHILDREN
  }

  // 使用插槽时, children是object, key就是具名插槽的名字
  if (vnode.shapeFlags & ShapeFlags.STATEFUL_COMPONENT && typeof children === 'object') {
    vnode.shapeFlags |= ShapeFlags.SLOTS_CHILDREN
  }

  return vnode
}

function getShapeFlag(type) {
  return typeof type === 'string' ? ShapeFlags.ELEMENT : ShapeFlags.STATEFUL_COMPONENT
}