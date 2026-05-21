/**
 * Minimal in-memory scheduler. Session-only (no persistence).
 *
 * Supports:
 *  - one-shot delays via `delaySeconds` or absolute `at`
 *  - 5-field cron expressions (* / range / step / list)
 *
 * When a job fires, every subscriber listener is called with the job + prompt.
 */

export interface ScheduledJob {
  id: string
  /** description shown in lists */
  reason?: string
  /** prompt fired on each match */
  prompt: string
  /** true → fires on every cron match until cancelled */
  recurring: boolean
  /** original cron expression, if any */
  cron?: string
  /** scheduled absolute time of next fire (ms epoch) */
  nextFireAt: number
  /** timer handle */
  _timer?: ReturnType<typeof setTimeout>
  /** when created */
  createdAt: number
}

export type JobFiredHandler = (job: ScheduledJob) => void

class Scheduler {
  private jobs = new Map<string, ScheduledJob>()
  private listeners = new Set<JobFiredHandler>()

  subscribe(fn: JobFiredHandler): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  list(): ScheduledJob[] {
    return [...this.jobs.values()]
      .map((j) => ({ ...j, _timer: undefined }))
      .sort((a, b) => a.nextFireAt - b.nextFireAt)
  }

  get(id: string): ScheduledJob | undefined {
    return this.jobs.get(id)
  }

  cancel(id: string): boolean {
    const j = this.jobs.get(id)
    if (!j) return false
    if (j._timer) clearTimeout(j._timer)
    this.jobs.delete(id)
    return true
  }

  /** schedule a one-shot job that fires N seconds from now. */
  scheduleAfter(delaySeconds: number, prompt: string, reason?: string): ScheduledJob {
    const clamped = Math.max(1, Math.min(3600 * 24 * 30, Math.floor(delaySeconds)))
    const id = genId()
    const fireAt = Date.now() + clamped * 1000
    const job: ScheduledJob = {
      id,
      reason,
      prompt,
      recurring: false,
      nextFireAt: fireAt,
      createdAt: Date.now()
    }
    job._timer = setTimeout(() => this.fire(job), clamped * 1000)
    this.jobs.set(id, job)
    return job
  }

  /** schedule a cron-style recurring (or one-shot) job. */
  scheduleCron(cron: string, prompt: string, recurring: boolean, reason?: string): ScheduledJob {
    const next = nextCronFire(cron, new Date())
    if (!next) throw new Error(`unable to compute next fire for cron "${cron}"`)
    const id = genId()
    const job: ScheduledJob = {
      id,
      reason,
      prompt,
      recurring,
      cron,
      nextFireAt: next.getTime(),
      createdAt: Date.now()
    }
    const delay = Math.max(0, next.getTime() - Date.now())
    job._timer = setTimeout(() => this.fire(job), delay)
    this.jobs.set(id, job)
    return job
  }

  private fire(job: ScheduledJob) {
    for (const fn of this.listeners) {
      try {
        fn(job)
      } catch (e) {
        console.error('scheduler listener threw:', e)
      }
    }
    if (job.recurring && job.cron) {
      const next = nextCronFire(job.cron, new Date(Date.now() + 1000))
      if (next) {
        job.nextFireAt = next.getTime()
        const delay = Math.max(1000, next.getTime() - Date.now())
        job._timer = setTimeout(() => this.fire(job), delay)
        return
      }
    }
    this.jobs.delete(job.id)
  }
}

function genId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/* ---------- minimal cron parser ---------- */

function matchField(v: number, expr: string, min: number, max: number): boolean {
  for (const part of expr.split(',')) {
    if (part === '*') return true
    const stepM = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/)
    if (stepM) {
      const step = +stepM[2]
      const range = stepM[1]
      let lo = min
      let hi = max
      if (range !== '*') {
        const [a, b] = range.split('-').map(Number)
        lo = a
        hi = b ?? max
      }
      if (v >= lo && v <= hi && (v - lo) % step === 0) return true
      continue
    }
    const rangeM = part.match(/^(\d+)-(\d+)$/)
    if (rangeM) {
      const a = +rangeM[1]
      const b = +rangeM[2]
      if (v >= a && v <= b) return true
      continue
    }
    if (+part === v) return true
  }
  return false
}

export function nextCronFire(cron: string, after: Date): Date | null {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const [mF, hF, domF, monF, dowF] = fields
  const t = new Date(after.getTime())
  t.setSeconds(0, 0)
  t.setMinutes(t.getMinutes() + 1)
  const MAX = 366 * 24 * 60
  for (let i = 0; i < MAX; i++) {
    if (
      matchField(t.getMinutes(), mF, 0, 59) &&
      matchField(t.getHours(), hF, 0, 23) &&
      matchField(t.getDate(), domF, 1, 31) &&
      matchField(t.getMonth() + 1, monF, 1, 12) &&
      matchField(t.getDay(), dowF, 0, 6)
    ) return new Date(t)
    t.setMinutes(t.getMinutes() + 1)
  }
  return null
}

export const scheduler = new Scheduler()
