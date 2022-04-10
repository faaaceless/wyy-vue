const queue: any[] = []
let isFlushPending = false
const p = Promise.resolve()

export function queueJobs(job) {
  if (!queue.includes(job)) queue.push(job)

  queueFlush()
}

// NOTE:因为是异步更新组件，这个接口让用户可以在这个函数里方便访问更新完的组件
export function nextTick(fn) {
  return fn ? p.then(fn) : p
}

function queueFlush() {
  if (isFlushPending) return
  // 第一次进queueJobs到这里进入pending态，然后把flush加入promise
  // 之后直接往queue里添加任务了
  isFlushPending = true

  nextTick(flushJobs)
}

function flushJobs() {
  isFlushPending = false
  let job
  while ((job = queue.shift())) {
    job && job()
  }
}