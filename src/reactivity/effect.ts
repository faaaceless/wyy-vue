// targetMap[target]->depsMap[key]->dep->effect
// 这里记录的是依赖于这个target的依赖
const targetMap = new WeakMap()
// 全局变量让dep能记录到
let activeEffect,
  shouldTrack = true

// 依赖的结构
class Effect {
  private _fn: () => void
  public scheduler?: () => void
  public onStop?: () => void
  // deps记录的是被这个依赖, 依赖的那些target的dep
  public deps: any = []
  public active: boolean = true
  constructor(fn, scheduler?) {
    this._fn = fn
    this.scheduler = scheduler
  }

  run() {
    // 这是为了stop后runner也能触发fn
    if (!this.active) {
      return this._fn()
    }
    // 把依赖给到全局变量, fn执行的时候会走get->track->收集effect
    activeEffect = this
    // NOTE:vue3这里用shouldTrack来判断是否需要收集依赖, 和直接在结束后设定activeEffect=null有什么区别?
    // shouldTrack = true
    const res = this._fn()
    // 设为null来打断普通get的track
    activeEffect = null
    // shouldTrack = false
    return res
  }

  stop() {
    if (this.active) {
      cleanEffect(this)
      this.active = false
      // onStop是stop的回调
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}

function cleanEffect(effect: Effect) {
  // 从它依赖的所有target.key记录的依赖dep中删除它
  effect.deps.forEach((dep: any) => {
    dep.delete(effect)
  })
  // 因为本身不再包含于那些Set(), 因此不用再记录了, 长度清零
  effect.deps.length = 0
}

// 记录依赖
function track(target, key) {
  if (!tracking()) return
  // if (!shouldTrack) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key)
  if (!dep) {
    // 用set是为了不重复收集
    dep = new Set()
    depsMap.set(key, dep)
  }

  trackEffect(dep)
}

function tracking() {
  // 如果不是通过Effect->run进来的, 而是普通get访问, 就不用track
  return activeEffect
  // return activeEffect && shouldTrack
}

function trackEffect(dep) {
  // NOTE: 既然判断再添加, 为什么不用Array?
  // Set.has 性能优于 Array.includes
  if (dep.has(activeEffect)) return
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}

// 执行依赖
function trigger(target, key) {
  let depsMap = targetMap.get(target)
  // 都没对这个target进行track, depsMap是undefined
  if (!depsMap) return
  let dep = depsMap.get(key)
  triggerEffects(dep)
}

function triggerEffects(dep) {
  dep.forEach((effect: Effect) => {
    // 有scheduler就不执行依赖
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  })
  // FIXME: 做到runtime-core更新element的时候发现for-of遍历不了，编译问题？
  // for (const effect of dep) {
  //   console.log(effect)
  //   if (effect.scheduler) {
  //     effect.scheduler()
  //   } else {
  //     effect.run()
  //   }
  // }
}

// 删除依赖
function stop(runner) {
  runner.effect.stop()
}

// 创建依赖
function effect(fn, options?) {
  const _effect = new Effect(fn, options?.scheduler)
  // 把options给到effect
  Object.assign(_effect, options)
  // lazy option
  if (!options?.lazy) _effect.run()

  // 返回runner
  const runner: any = _effect.run.bind(_effect)
  // 让stop函数能找到runner对应的effect
  runner.effect = _effect
  return runner
}

export {
  Effect,
  effect,
  track,
  trigger,
  stop,
  trackEffect,
  triggerEffects,
  tracking,
}
