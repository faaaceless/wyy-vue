import { ShapeFlags } from "./ShapeFlags"

export function initSlots(instance, children) {

  const { vnode } = instance
  
  if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    for (const key in children) {
      // 这里函数的返回值, 会在renderSlots里被createVNode调用, 接受的参数是数组 
      instance.slots[key] = (props) => normalizeSlot(children[key](props))
    }
  }
}

function normalizeSlot(val) {
  return Array.isArray(val) ? val : [val]
}