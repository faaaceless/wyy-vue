import { effect, isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"
import { createAppAPI } from "./createApp"
import { ShapeFlags } from "./ShapeFlags"
import { Fragment, Text } from "./vnode"

export function createRenderer(options) {
  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
  } = options

  function render(vnode, container) {
    patch(null, vnode, container, null, null)
  }

  // n1:prevVnode n2:curVnode
  function patch(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    const { type, shapeFlag } = n2

    switch (type) {
      // Fragment 只渲染子节点
      case Fragment:
        processFragment(n1, n2, container, parentComponent, anchor)
        break
      case Text:
        processText(n1, n2, container)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理DOM Element
          processElement(n1, n2, container, parentComponent, anchor)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 处理组件
          processComponent(n1, n2, container, parentComponent, anchor)
        }
    }
  }

  function processFragment(
    n1: any,
    n2: any,
    container: any,
    parentComponent: any,
    anchor
  ) {
    mountChildren(n2.children, container, parentComponent, anchor)
  }

  function processText(n1: any, n2: any, container: any) {
    const textNode = (n2.el = document.createTextNode(n2.children))
    container.append(textNode)
  }

  function processElement(
    n1: any,
    n2: any,
    container: any,
    parentComponent: any,
    anchor: any
  ) {
    // 没有n1走初始化， 有n1走更新
    if (!n1) {
      mountElement(n2, container, parentComponent, anchor)
    } else {
      patchElement(n1, n2, parentComponent, anchor)
    }
  }

  function patchElement(n1: any, n2: any, parentComponent: any, anchor) {
    console.log(n1, n2)

    // n1经历了mountElement 而n2还没有，所以只能从n1读dom
    const el = (n2.el = n1.el)

    // 更新props
    const prevProps = n1.props ?? {}
    const curProps = n2.props ?? {}

    // 从这里开始container变成了n2.el
    patchChildren(n1, n2, el, parentComponent, anchor)
    patchProps(prevProps, curProps, el)
  }

  function patchChildren(n1: any, n2: any, container: any, parentComponent: any, anchor) {
    const { shapeFlag: preShapeFlag } = n1
    const { shapeFlag: curShapeFlag } = n2

    if (curShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // unmount 如果是Array to Text
      if (preShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(n1.children)
      }
      if (n1.children !== n2.children) {
        hostSetElementText(container, n2.children)
      }
    } else {
      if (preShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 清空之前的文本
        hostSetElementText(container, "")
        // mount 新的
        mountChildren(n2.children, container, parentComponent, anchor)
      } else {
        // array to array
        patchKeyedChildren(n1.children, n2.children, container, parentComponent, anchor)
      }
    }
  }

  function patchKeyedChildren(
    c1: any,
    c2: any,
    container: any,
    parentComponent: any,
    anchor
  ) {
    let i = 0
    // end
    let e1 = c1.length - 1
    let e2 = c2.length - 1

    // 收缩左侧
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, anchor)
      } else {
        // move i to the first item that is different
        break
      }
      i++
    }

    // 收缩右侧
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, anchor)
      } else {
        // move e1 and e2 respectively to the last items that are different
        break
      }
      e1--
      e2--
    }

    // 简单情况下，cur是pre的一部分，或pre是cur的一部分
    // cur的某侧比pre长，直接mount新的来扩展该侧
    if (i > e1 && i <= e2) {
      // 通过anchor决定左侧还是右侧
      const anchor = e1 < 0 ? c2[e2 + 1].el : null
      for (let tmp = i; tmp <= e2; tmp++) {
        patch(null, c2[tmp], container, parentComponent, anchor)
      }
    } else if (i > e2) {
      // cur的某侧比pre短，删除pre来缩短
      for (let tmp = i; tmp <= e1; tmp++) {
        hostRemove(c1[tmp].el)
      }
    }
  }

  function isSameVNodeType(n1: any, n2: any) {
    return n1.type === n2.type && n1.key === n2.key
  }

  function unmountChildren(children: any) {
    for (let i = 0; i < children.length; i++) {
      const el = children[i].el
      hostRemove(el)
    }
  }

  function patchProps(prevProps: any, curProps: any, el: any) {
    if (prevProps === curProps) return

    for (const key in curProps) {
      const prevProp = prevProps[key]
      const curProp = curProps[key]
      // 新值不等于老值, 以前不存在的prop也包含在内
      if (prevProp !== curProp) {
        hostPatchProp(el, key, prevProp, curProp)
      }
    }
    // 删除不再存在的prop
    for (const key in prevProps) {
      if (!(key in curProps)) {
        hostPatchProp(el, key, prevProps[key], null)
      }
    }
  }

  function mountElement(vnode: any, container: any, parentComponent: any, anchor: any) {
    const { type, props, children, shapeFlag } = vnode
    // 把创建的dom传给vnode.el
    const el = (vnode.el = hostCreateElement(type))

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 文字节点
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 多个子节点
      mountChildren(children, el, parentComponent, anchor)
    }
    // 设置属性
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }

    // 把dom挂载到container上
    hostInsert(el, container, anchor)
  }

  function mountChildren(
    children: any,
    container: any,
    parentComponent: any,
    anchor: any
  ) {
    children.forEach((child) => {
      // 再分为用vnode定义的DOM子节点和文本节点
      if (isObject(child)) {
        patch(null, child, container, parentComponent, anchor)
      }
    })
  }

  function processComponent(
    n1: any,
    n2: any,
    container: any,
    parentComponent: any,
    anchor
  ) {
    mountComponent(n2, container, parentComponent, anchor)
  }

  function mountComponent(vnode: any, container: any, parentComponent: any, anchor) {
    const instance = createComponentInstance(vnode, parentComponent)

    setupComponent(instance)
    setupRenderEffect(instance, container, anchor)
  }

  function setupRenderEffect(instance, container, anchor) {
    // 用effect包裹, 在响应对象发生改变后，会再次触发render
    effect(() => {
      if (!instance.isMounted) {
        const { proxy } = instance
        // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
        // 用call把render的this绑定到proxy上,
        // 之后就能在render里用this来访问到instance的setup结果
        const subTree = (instance.subTree = instance.render.call(proxy))
        // subTree 就是组件的虚拟dom树
        patch(null, subTree, container, instance, anchor)

        // NOTE: patch先进到mountElement, el把dom挂到自己的vnode上,
        // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
        // 这样就实现 $el 接口, 在proxy设置
        instance.vnode.el = subTree.el

        instance.isMounted = true
      } else {
        const { proxy } = instance
        const prevTree = instance.subTree
        const subTree = (instance.subTree = instance.render.call(proxy))
        patch(prevTree, subTree, container, instance, anchor)
      }
    })
  }

  return {
    createApp: createAppAPI(render),
  }
}
