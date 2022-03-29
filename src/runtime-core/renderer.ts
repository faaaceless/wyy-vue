import { isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"
import { ShapeFlags } from "./ShapeFlags"

export function render(vnode, container) {
  patch(vnode, container)
}

function patch(vnode, container) {
  if (vnode.shapeFlags & ShapeFlags.ELEMENT) {
    // 处理DOM Element
    processElement(vnode, container)
  } else if (vnode.shapeFlags & ShapeFlags.STATEFUL_COMPONENT) {
    // 处理组件
    processComponent(vnode, container)
  }
}

function processElement(vnode: any, container: any) {
  mountElement(vnode, container)
}

function mountElement(vnode: any, container: any) {
  const { type, props, children, shapeFlags } = vnode
  // 把dom传给vnode
  const el = vnode.el = document.createElement(type)

  if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
    // 文字节点
    el.textContent = children
  } else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
    // 多个子节点
    mountChildren(children, el)
  }
  // 设置属性
  const isEvent = (key:string) => /^on[A-Z]/.test(key)
  for (const key in props) {
    // NOTE:注册事件
    if (isEvent(key)) {
      el.addEventListener(key.slice(2).toLowerCase(), props[key])
    }
    // 或者attribute
    el.setAttribute(key, props[key])
  }
  // 把dom挂载到container上
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
  // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
  // 把render的this绑定到proxy上,
  // 之后就能在render里用this来访问到instance的setup结果
  const subTree = instance.render.call(proxy)
  patch(subTree, container)

  // NOTE: patch先进到mountElement, ele把dom挂到自己的vnode上,
  // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
  // 这样就实现 $el 接口, 在proxy设置
  instance.vnode.el = subTree.el
}

