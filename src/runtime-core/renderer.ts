import { isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"

export function render(vnode, container) {
  patch(vnode, container)
}

function patch(vnode, container) {
  if (typeof vnode.type === "string") {
    // 处理DOM Element
    processElement(vnode, container)
  } else if (isObject(vnode.type)) {
    // 处理组件
    processComponent(vnode, container)
  }
}

function processElement(vnode: any, container: any) {
  mountElement(vnode, container)
}

function mountElement(vnode: any, container: any) {
  const { type, props, children } = vnode
  // 把dom挂到vnode上
  const el = vnode.el = document.createElement(type)

  if (typeof children === 'string') {
    // 文字节点
    el.textContent = children
  } else if (Array.isArray(children)) {
    // 多个子节点
    mountChildren(children, el)
  }
  for (const key in props) {
    el.setAttribute(key, props[key])
  }
  container.append(el)
}

function mountChildren(children, container) {
  children.forEach(child => {
    // 再分为DOM子节点和当前节点的文本内容
    if (isObject(child)) {
      patch(child, container)
    } else if (typeof child === 'string') {
      container.textContent = child
    }
  })
}

function processComponent(vnode: any, container: any) {
  mountComponent(vnode, container)
}

function mountComponent(vnode: any, container: any) {
  const instance = createComponentInstance(vnode)

  setupComponent(instance)
  setupRenderEffect(instance, container)
}

function setupRenderEffect(instance, container) {
  const { proxy } = instance
  // 把render的this绑定到proxy上,
  // 之后就能在render里用this来访问到instance的setup结果
  const subTree = instance.render.call(proxy)
  patch(subTree, container)

  // NOTE: patch先进到mountElement, 把dom挂到vnode上
  // 再把组件实例的el绑定到根dom元素
  // 这样就实现 $el 接口, 在proxy设置
  instance.vnode.el = subTree.el
}

