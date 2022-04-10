import { effect, isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"
import { shouldUpdateComponent } from "./componentRenderUtils"
import { createAppAPI } from "./createApp"
import { queueJobs } from "./scheduler"
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
    // console.log(n1, n2)

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
    const { shapeFlag: prevShapeFlag } = n1
    const { shapeFlag: curShapeFlag } = n2

    if (curShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // unmount 如果是Array to Text
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(n1.children)
      }
      if (n1.children !== n2.children) {
        hostSetElementText(container, n2.children)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
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
    parentAnchor: any
  ) {
    let i = 0
    // end
    let e1 = c1.length - 1
    let e2 = c2.length - 1

    // 收缩左侧
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = c2[i]
      // 如果在这一层是相同的，送入patch继续递归
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor)
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
        patch(n1, n2, container, parentComponent, parentAnchor)
      } else {
        // move e1 and e2 respectively to the last items that are different
        break
      }
      e1--
      e2--
    }

    // 简单情况下，cur是prev的一部分，或prev是cur的一部分
    if (i > e1 && i <= e2) {
      // cur的某侧比prev长，直接mount新的来扩展该侧
      // 通过anchor决定左侧还是右侧
      const anchor = e1 < 0 ? c2[e2 + 1].el : parentAnchor
      for (let idx = i; idx <= e2; idx++) {
        patch(null, c2[idx], container, parentComponent, anchor)
      }
    } else if (i > e2) {
      // cur的某侧比prev短，删除prev来缩短
      for (let idx = i; idx <= e1; idx++) {
        hostRemove(c1[idx].el)
      }
    } else {
      // 两边一样，中间不同
      // i 到 e2 之间的节点，也就是cur要用来比较的节点
      const toBePatched = e2 - i + 1
      // 用于减少循环内的判断
      let patched = 0
      // 一些映射
      const keyToCurIdx = new Map()
      const curIdxToPrevIdx = new Array(toBePatched).fill(0)
      // 判断是否需要移动
      let moved = false
      let maxNewIdx = -1

      // curChildren 的 key : idx
      for (let idx = i; idx <= e2; idx++) {
        const curChild = c2[idx]
        keyToCurIdx.set(curChild.key, idx)
      }

      // 为prev找对应的cur
      for (let idx = i; idx <= e1; idx++) {
        const prevChild = c1[idx]

        // cur全找到对应的prev了， 剩下的都要remove
        if (patched >= toBePatched) {
          hostRemove(prevChild.el)
          continue
        }

        let newIdx
        if (prevChild.key) {
          newIdx = keyToCurIdx.get(prevChild.key)
        } else {
          for (let curIdx = i; curIdx <= e2; curIdx++) {
            if (isSameVNodeType(c2[curIdx], prevChild)) {
              newIdx = curIdx
              break
            }
          }
        }
        // 找不到就删除，找到了进一步patch
        if (newIdx === undefined) {
          console.log("remove " + prevChild.props.key)
          hostRemove(prevChild.el)
        } else {
          maxNewIdx = newIdx > maxNewIdx ? newIdx : (moved = true)

          // -i是让curIdx待定的部分从0开始，+1是为了让prevIdx从1开始, 0代表没找到
          curIdxToPrevIdx[newIdx - i] = idx + 1
          patch(prevChild, c2[newIdx], container, parentComponent, parentAnchor)
          patched++
        }
      }

      // NOTE: 利用最长增长子序列减少插入次数，即该序列中的位置不变，其他元素移动
      // 这里的逻辑在于：curIdxToPrevIdx的序号是curIdx, value是prevIdx
      // 利用getSequence求出prevIdx的最长增长子序列，但输出的是序号，也就是不需要移动的元素的curIdx
      const increasingNewIdxSequence = moved ? getSequence(curIdxToPrevIdx) : []
      let j = increasingNewIdxSequence.length - 1
      // console.log(curIdxToPrevIdx)
      // console.log(increasingNewIdxSequence)

      for (let idx = toBePatched - 1; idx >= 0; idx--) {
        const curIdx = idx + i
        const curChild = c2[curIdx]
        // 因为从后往前，后面优先创建，锚点就是下一个点
        const anchor = curIdx + 1 < c2.length ? c2[curIdx + 1].el : parentAnchor

        // ===0说明idx这个节点在prev里没找到，需要创建
        if (curIdxToPrevIdx[idx] === 0) {
          console.log("create " + curChild.props.key)
          patch(null, curChild, container, parentComponent, anchor)
        } else if (moved) {
          if (j < 0 || idx !== increasingNewIdxSequence[j]) {
            console.log("move " + curChild.props.key)
            hostInsert(curChild.el, container, anchor)
          } else {
            j--
          }
        }
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
    if (!n1) {
      mountComponent(n2, container, parentComponent, anchor)
    } else {
      updateComponent(n1, n2)
    }
  }

  function updateComponent(n1: any, n2: any) {
    // 组件更新其实就是组件的props更新，然后继续patch下去看element要不要更新
    const instance = (n2.component = n1.component)
    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2
      instance.update()
    } else {
      // NOTE:如果不需要更新，则把需要信息从n1上copy到n2上
      // 不copy报错的情况，第一次跳过它，第二次改变它的props
      // 因为此时n2已经render完并挂载在instance的subtree上，之后再改变用来做比较的prev就是它
      // 要copy过来的信息包括component和el
      n2.el = n1.el
      instance.vnode = n2
    }
  }

  function mountComponent(vnode: any, container: any, parentComponent: any, anchor) {
    const instance = (vnode.component = createComponentInstance(vnode, parentComponent))

    setupComponent(instance)
    setupRenderEffect(instance, container, anchor)
  }

  function setupRenderEffect(instance, container, anchor) {
    // 用effect包裹, 在响应对象发生改变后，会再次触发render
    // instance.update就是runner
    instance.update = effect(
      () => {
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
          // 组件的n2 和 n1
          const { next, vnode } = instance
          // 更新组件然后重新render
          if (next) {
            next.el = vnode.el
            updateComponentPreRender(instance, next)
          }

          const { proxy } = instance
          const prevTree = instance.subTree
          const subTree = (instance.subTree = instance.render.call(proxy))
          patch(prevTree, subTree, container, instance, anchor)
        }
      },
      {
        scheduler() {
          // runner加入queue, 组件异步更新, runner是不会再进schedule的
          queueJobs(instance.update)
        },
      }
    )
  }

  return {
    createApp: createAppAPI(render),
  }
}

function updateComponentPreRender(instance: any, nextVNode: any) {
  instance.vnode = nextVNode
  instance.next = null
  instance.props = nextVNode.props
}

// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
