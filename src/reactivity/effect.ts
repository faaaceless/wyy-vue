// targetMap[target]->depsMap[key]->dep->effect
// 这里记录的是依赖于这个target的依赖
const targetMap = new WeakMap()
// 全局变量让dep能记录到
let activeEffect,
  shouldTrack = true


// 依赖的结构
class Effect {
  private _fn: () => void
  scheduler?: () => void
  onStop?: () => void
  // deps记录的是这个依赖依赖的那些target的依赖Set()
  deps = []
  active = true
  constructor(fn, scheduler?) {
    this._fn = fn
    this.scheduler = scheduler
  }

  run() {
    // 这是为了stop后runner也能触发
    if (!this.active) {
      return this._fn()
    }
    // 把依赖给到全局变量, fn执行的时候会走get->track->收集effect
    activeEffect = this
    // TODO:vue3这里用shouldTrack来判断是否需要收集依赖, 和直接在结束后设定activeEffect=null有什么区别?
    // shouldTrack = true
    const res = this._fn()
    activeEffect = null
    // shouldTrack = false
    return res
  }

  stop() {
    if (this.active) {
      cleanEffect(this)
      this.active = false
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}

function cleanEffect(effect) {
  // 从所有记录的依赖Set()中删除它
  effect.deps.forEach((dep: any) => {
    dep.delete(effect)
  })
  // 因为本身不再包含于那些Set(), 因此不用再记录了, 长度清零
  effect.deps.length = 0
}

// 记录依赖
function track(target, key) {
  // 如果不是通过Effect run进来的, 而是普通get访问, 就不用track
  if (!activeEffect) return
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
  // TODO: 既然判断再添加, 为什么不用Array?
  // Set.has 性能优于 Array.includes
  if (dep.has(activeEffect)) return 
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}

// 执行依赖
function trigger(target, key) {
  let depsMap = targetMap.get(target)
  let dep = depsMap.get(key)
  for (let effect of dep) {
    // 有scheduler就不执行依赖
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
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
  _effect.run()
  // 返回runner
  const runner: any = _effect.run.bind(_effect)
  // 为了stop
  runner.effect = _effect
  return runner
}

export { effect, track, trigger, stop }
