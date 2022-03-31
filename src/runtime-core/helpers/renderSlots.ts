import { createVNode } from "../vnode"

// key就是具名插槽的名字, props就是作用域插槽传递的数据
export function renderSlots(slots, key, props) {
  const slot = slots[key]

  if (slot && typeof slot === 'function') {
    // 这个slot是在上级组件里定义的函数, 就是通过这里把子组件的参数传上去
    return createVNode("div", {}, slot(props))
  }
}

