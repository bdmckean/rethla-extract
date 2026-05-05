import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const SESSION_KEY = 'transcript_app_ui_session_v1'
const CLIENT_SESSION_KEY = 'transcript_app_client_session_v1'
const UI_LANG_KEY = 'transcript_app_ui_lang_v1'

type SessionSnapshot = { outputDir: string }

function readSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return null
    const outputDir = (o as { outputDir?: unknown }).outputDir
    return {
      outputDir: typeof outputDir === 'string' ? outputDir : '',
    }
  } catch {
    return null
  }
}

function writeSessionSnapshot(s: SessionSnapshot | null) {
  try {
    if (!s) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* private mode or quota */
  }
}

function getClientSessionId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_SESSION_KEY)
    if (existing && existing.length >= 8) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(CLIENT_SESSION_KEY, created)
    return created
  } catch {
    return 'anonymous'
  }
}

type HealthResponse = { status: string }

type JobState = {
  id: string
  source_name?: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  phase: string | null
  phase_percent: number
  overall_percent: number
  started_at: number | null
  elapsed_sec: number | null
  eta_sec: number | null
  error: string | null
  transcript_path: string | null
}

type QueuedJob = {
  id: string
  source_name: string
  output_dir: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  phase: string | null
  phase_percent: number
  overall_percent: number
  elapsed_sec: number | null
  eta_sec: number | null
  error: string | null
  transcript_path: string | null
}

type CompletedItem = {
  name: string
  path: string
  size_bytes: number
  modified: number
}

type UsageRun = {
  id: string
  job_id: string
  source_name: string
  source_size_bytes: number | null
  source_path: string | null
  output_name: string | null
  output_path: string | null
  output_dir: string
  locale: string
  status: 'completed' | 'failed' | string
  error_message: string | null
  elapsed_sec: number | null
  completed_at: string | null
}

type UsageSummary = {
  total_runs: number
  completed_runs: number
  failed_runs: number
  total_source_bytes: number
  total_elapsed_sec: number
}

type UiLang = 'en' | 'es'

const UI_STRINGS: Record<UiLang, Record<string, string>> = {
  en: {
    appTitle: 'Transcript App',
    appTagline: 'Speaker-attributed transcripts from audio',
    switchLanguage: 'ES',
    extractTitle: 'Extract transcript',
    extractIntro:
      'Transcripts are written on the machine running the API. Use "Select folder..." for a native directory picker (local dev, loopback only). You can still type an absolute path. Upload sends audio to the server; one job at a time. This tab remembers the active job until you dismiss it or close the tab.',
    outputDirectory: 'Output directory',
    outputHint:
      'Use Select folder or type an absolute path, then optionally create a new subfolder inside it.',
    absolutePath: 'Absolute path',
    selectFolder: 'Select folder...',
    dialogOpen: 'Dialog open...',
    newSubfolder: 'New subfolder under this path',
    subfolderPlaceholder: 'e.g. transcripts_march',
    createUse: 'Create & use',
    creating: 'Creating...',
    audioFile: 'Audio file',
    headerLocale: 'Header locale',
    startExtraction: 'Start extraction',
    starting: 'Starting...',
    processingQueue: 'Processing queue',
    queueEmpty: 'No jobs queued yet.',
    queueOutputDir: 'Output directory',
    compactQueue: 'Compact queue',
    expandedQueue: 'Expanded queue',
    clearCompleted: 'Clear completed',
    clearFailed: 'Clear failed',
    clearFinished: 'Clear finished',
    cancelQueued: 'Cancel',
    moveUp: 'Up',
    moveDown: 'Down',
    queueActionFailed: 'Queue action failed',
    chooseAudio: 'Choose an audio file.',
    enterOutputDir: 'Enter the output directory path on the machine running the API (absolute path).',
    selectOutputFirst: 'Select or enter an output directory first.',
    enterFolderName: 'Enter a name for the new folder.',
    folderPickerFailed: 'Folder picker failed',
    createFolderFailed: 'Could not create folder',
    startFailed: 'Start failed',
    pollFailed: 'Poll failed',
    listFailed: 'List failed',
    usageLoadFailed: 'Usage load failed',
    jobNotFound: 'Job not found (API may have restarted).',
    job: 'Job',
    step: 'Step',
    inCurrentStep: 'in current step',
    overall: 'overall',
    elapsed: 'Elapsed',
    eta: 'ETA',
    estimate: 'estimate',
    wrote: 'Wrote',
    dismissJob: 'Dismiss job',
    restored: 'Restored',
    loadingStatus: 'from this tab — loading status…',
    recentActivity: 'Recent activity',
    runs: 'Runs',
    completed: 'Completed',
    failed: 'Failed',
    sourceBytes: 'Source bytes',
    processingTime: 'Processing time',
    noHistory: 'No extraction history for this browser session yet.',
    size: 'Size',
    processed: 'Processed',
    output: 'Output',
    outputDir: 'Output dir',
    outputPath: 'Output path',
    viewInNewTab: 'Open in new tab',
    refreshActivity: 'Refresh activity',
    completedTranscripts: 'Completed transcripts',
    scansPattern: 'Scans',
    enterOutputToList: 'Enter an output directory to list files.',
    noTranscriptsYet: 'No transcript files found yet.',
    refreshList: 'Refresh list',
    loadModel: 'Load model',
    transcribe: 'Transcribe',
    align: 'Align',
    diarize: 'Diarize',
    finalize: 'Finalize',
  },
  es: {
    appTitle: 'App de Transcripciones',
    appTagline: 'Transcripciones de audio con hablantes',
    switchLanguage: 'EN',
    extractTitle: 'Extraer transcripción',
    extractIntro:
      'Las transcripciones se escriben en la máquina que ejecuta la API. Usa "Seleccionar carpeta..." para abrir un selector nativo (desarrollo local, loopback). También puedes escribir una ruta absoluta. La carga envía el audio al servidor; un trabajo a la vez. Esta pestaña recuerda el trabajo activo hasta que lo cierres o lo descartes.',
    outputDirectory: 'Directorio de salida',
    outputHint:
      'Usa Seleccionar carpeta o escribe una ruta absoluta; luego, si quieres, crea una subcarpeta dentro.',
    absolutePath: 'Ruta absoluta',
    selectFolder: 'Seleccionar carpeta...',
    dialogOpen: 'Diálogo abierto...',
    newSubfolder: 'Nueva subcarpeta dentro de esta ruta',
    subfolderPlaceholder: 'p. ej. transcripciones_marzo',
    createUse: 'Crear y usar',
    creating: 'Creando...',
    audioFile: 'Archivo de audio',
    headerLocale: 'Idioma del encabezado',
    startExtraction: 'Iniciar extracción',
    starting: 'Iniciando...',
    processingQueue: 'Cola de procesamiento',
    queueEmpty: 'Aún no hay trabajos en cola.',
    queueOutputDir: 'Directorio de salida',
    compactQueue: 'Cola compacta',
    expandedQueue: 'Cola expandida',
    clearCompleted: 'Quitar completados',
    clearFailed: 'Quitar fallidos',
    clearFinished: 'Quitar finalizados',
    cancelQueued: 'Cancelar',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    queueActionFailed: 'Falló la acción de cola',
    chooseAudio: 'Selecciona un archivo de audio.',
    enterOutputDir: 'Introduce la ruta del directorio de salida en la máquina que ejecuta la API (ruta absoluta).',
    selectOutputFirst: 'Selecciona o escribe primero un directorio de salida.',
    enterFolderName: 'Escribe un nombre para la nueva carpeta.',
    folderPickerFailed: 'Falló el selector de carpeta',
    createFolderFailed: 'No se pudo crear la carpeta',
    startFailed: 'No se pudo iniciar',
    pollFailed: 'Falló la consulta',
    listFailed: 'Falló el listado',
    usageLoadFailed: 'Falló la carga de actividad',
    jobNotFound: 'Trabajo no encontrado (la API pudo reiniciarse).',
    job: 'Trabajo',
    step: 'Paso',
    inCurrentStep: 'en el paso actual',
    overall: 'global',
    elapsed: 'Transcurrido',
    eta: 'ETA',
    estimate: 'estimado',
    wrote: 'Escribió',
    dismissJob: 'Descartar trabajo',
    restored: 'Restaurado',
    loadingStatus: 'desde esta pestaña — cargando estado…',
    recentActivity: 'Actividad reciente',
    runs: 'Ejecuciones',
    completed: 'Completadas',
    failed: 'Fallidas',
    sourceBytes: 'Bytes de origen',
    processingTime: 'Tiempo de proceso',
    noHistory: 'Aún no hay historial para esta sesión del navegador.',
    size: 'Tamaño',
    processed: 'Procesado',
    output: 'Salida',
    outputDir: 'Directorio de salida',
    outputPath: 'Ruta de salida',
    viewInNewTab: 'Abrir en pestaña nueva',
    refreshActivity: 'Actualizar actividad',
    completedTranscripts: 'Transcripciones completadas',
    scansPattern: 'Busca',
    enterOutputToList: 'Escribe un directorio de salida para listar archivos.',
    noTranscriptsYet: 'Aún no hay transcripciones.',
    refreshList: 'Actualizar lista',
    loadModel: 'Cargar modelo',
    transcribe: 'Transcribir',
    align: 'Alinear',
    diarize: 'Diarizar',
    finalize: 'Finalizar',
  },
}

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '—'
  if (sec < 60) return `${Math.floor(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  const mib = kib / 1024
  if (mib < 1024) return `${mib.toFixed(1)} MiB`
  return `${(mib / 1024).toFixed(2)} GiB`
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  return i === -1 ? normalized : normalized.slice(i + 1)
}

function transcriptFileUrl(outputDir: string, fileName: string): string {
  const q = new URLSearchParams({
    output_dir: outputDir.trim(),
    name: fileName.trim(),
  })
  return `/api/output/file?${q}`
}

const PIPELINE_STEPS = ['load_model', 'transcribe', 'align', 'diarize', 'finalize'] as const

type StepVisual = 'pending' | 'active' | 'done' | 'failed'

function pipelineStepVisuals(job: JobState): StepVisual[] {
  const n = PIPELINE_STEPS.length
  if (job.status === 'completed') {
    return Array.from({ length: n }, () => 'done' as const)
  }
  if (job.status === 'failed') {
    const raw = PIPELINE_STEPS.findIndex((s) => s === job.phase)
    const failIdx = raw === -1 ? 0 : raw
    return PIPELINE_STEPS.map((_, i) => {
      if (i < failIdx) return 'done'
      if (i === failIdx) return 'failed'
      return 'pending'
    })
  }
  if (job.status === 'queued') {
    return PIPELINE_STEPS.map((_, i) => (i === 0 ? 'active' : 'pending'))
  }
  const raw = PIPELINE_STEPS.findIndex((s) => s === job.phase)
  const idx = raw === -1 ? 0 : raw
  const pct = job.phase_percent
  return PIPELINE_STEPS.map((_, i) => {
    if (i < idx) return 'done'
    if (i === idx) {
      if (pct < 100) return 'active'
      return 'done'
    }
    if (i === idx + 1 && pct >= 100) return 'active'
    return 'pending'
  })
}

function PipelineStepIndicator({
  job,
  stepLabels,
}: {
  job: JobState
  stepLabels: Record<(typeof PIPELINE_STEPS)[number], string>
}) {
  const visuals = pipelineStepVisuals(job)
  return (
    <ol className="pipeline-steps" aria-label="Extraction pipeline steps">
      {PIPELINE_STEPS.map((stepId, i) => {
        const v = visuals[i]
        const label = stepLabels[stepId]
        const title = `${label}: ${v}`
        return (
          <li key={stepId} className="pipeline-step">
            <span
              className={`pipeline-step-box pipeline-step-box--${v}`}
              title={title}
              aria-label={title}
            />
            <span className="pipeline-step-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function App() {
  const sessionInit = useMemo(() => readSessionSnapshot(), [])
  const [uiLang, setUiLang] = useState<UiLang>(() => {
    try {
      const v = localStorage.getItem(UI_LANG_KEY)
      return v === 'es' ? 'es' : 'en'
    } catch {
      return 'en'
    }
  })
  const clientSessionId = useMemo(() => getClientSessionId(), [])
  const [health, setHealth] = useState<HealthResponse | null>(null)

  const [outputDir, setOutputDir] = useState(sessionInit?.outputDir ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [locale, setLocale] = useState<'es' | 'en'>('es')
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([])
  const [jobError, setJobError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pickingFolder, setPickingFolder] = useState(false)
  const [pickFolderError, setPickFolderError] = useState<string | null>(null)
  const [subfolderName, setSubfolderName] = useState('')
  const [creatingSubfolder, setCreatingSubfolder] = useState(false)
  const [subfolderError, setSubfolderError] = useState<string | null>(null)

  const [completed, setCompleted] = useState<CompletedItem[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [usageRuns, setUsageRuns] = useState<UsageRun[]>([])
  const t = useMemo(() => UI_STRINGS[uiLang], [uiLang])
  const stepLabels = useMemo(
    () => ({
      load_model: t.loadModel,
      transcribe: t.transcribe,
      align: t.align,
      diarize: t.diarize,
      finalize: t.finalize,
    }),
    [t]
  )

  useEffect(() => {
    try {
      localStorage.setItem(UI_LANG_KEY, uiLang)
    } catch {
      /* ignore persistence issues */
    }
  }, [uiLang])

  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [queueCompact, setQueueCompact] = useState(false)

  const loadCompleted = useCallback(async () => {
    const dir = outputDir.trim()
    if (!dir) {
      setCompleted([])
      return
    }
    setListError(null)
    try {
      const q = new URLSearchParams({ output_dir: dir })
      const r = await fetch(`/api/output/list?${q}`)
      if (!r.ok) {
        const t = await r.text()
        throw new Error(t || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as { items: CompletedItem[] }
      setCompleted(data.items)
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : t.listFailed)
      setCompleted([])
    }
  }, [outputDir, t.listFailed])

  const loadUsage = useCallback(async () => {
    setUsageError(null)
    try {
      const r = await fetch('/api/usage/runs?limit=12', {
        headers: { 'X-Client-Session': clientSessionId },
      })
      if (!r.ok) {
        const t = await r.text()
        throw new Error(t || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as { items: UsageRun[]; summary: UsageSummary }
      setUsageRuns(data.items)
      setUsageSummary(data.summary)
    } catch (e: unknown) {
      setUsageError(e instanceof Error ? e.message : t.usageLoadFailed)
      setUsageRuns([])
      setUsageSummary(null)
    }
  }, [clientSessionId, t.usageLoadFailed])

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<HealthResponse>
      })
      .then((data) => {
        if (!cancelled) setHealth(data)
      })
      .catch(() => {
        if (!cancelled) setHealth(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCompleted()
    }, 400)
    return () => window.clearTimeout(t)
  }, [loadCompleted])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadUsage()
    }, 250)
    return () => window.clearTimeout(t)
  }, [loadUsage])

  useEffect(() => {
    writeSessionSnapshot({ outputDir: outputDir.trim() })
  }, [outputDir])

  useEffect(() => {
    const active = queuedJobs.filter((j) => j.status === 'queued' || j.status === 'running')
    if (active.length === 0) return
    let cancelled = false
    const tick = async () => {
      try {
        const updated = await Promise.all(
          active.map(async (item) => {
            const r = await fetch(`/api/jobs/${item.id}`)
            if (r.status === 404) {
              return { ...item, status: 'failed' as const, error: t.jobNotFound }
            }
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const j = (await r.json()) as JobState
            return {
              ...item,
              source_name: j.source_name?.trim() || item.source_name,
              status: j.status,
              phase: j.phase,
              phase_percent: j.phase_percent,
              overall_percent: j.overall_percent,
              elapsed_sec: j.elapsed_sec,
              eta_sec: j.eta_sec,
              error: j.error,
              transcript_path: j.transcript_path,
            }
          })
        )
        if (!cancelled) {
          setJobError(null)
          setQueuedJobs((prev) =>
            prev.map((existing) => updated.find((u) => u.id === existing.id) ?? existing)
          )
          const terminal = updated.some((j) => j.status === 'completed' || j.status === 'failed')
          if (terminal) {
            void loadCompleted()
            void loadUsage()
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setJobError(e instanceof Error ? e.message : t.pollFailed)
        }
      }
    }
    void tick()
    const id = window.setInterval(tick, 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [queuedJobs, loadCompleted, loadUsage, t.jobNotFound, t.pollFailed])

  const extractionInFlight = submitting

  function dismissJobPanel() {
    setJobError(null)
    setSubmitting(false)
    setQueuedJobs((prev) => prev.filter((j) => j.status === 'queued' || j.status === 'running'))
  }

  function clearCompletedJobs() {
    setQueuedJobs((prev) => prev.filter((j) => j.status !== 'completed'))
  }

  function clearFailedJobs() {
    setQueuedJobs((prev) => prev.filter((j) => j.status !== 'failed'))
  }

  async function cancelQueuedJob(jobId: string) {
    try {
      const r = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
      if (!r.ok) {
        const raw = await r.text()
        throw new Error(raw || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as JobState
      setQueuedJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: data.status,
                error: data.error,
                elapsed_sec: data.elapsed_sec,
              }
            : j
        )
      )
      void loadUsage()
    } catch (e: unknown) {
      setJobError(e instanceof Error ? e.message : t.queueActionFailed)
    }
  }

  async function moveQueuedJob(jobId: string, direction: -1 | 1) {
    const queuedIds = queuedJobs.filter((j) => j.status === 'queued').map((j) => j.id)
    const idx = queuedIds.indexOf(jobId)
    if (idx === -1) return
    const target = idx + direction
    if (target < 0 || target >= queuedIds.length) return
    try {
      const r = await fetch(`/api/jobs/${jobId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: target }),
      })
      if (!r.ok) {
        const raw = await r.text()
        throw new Error(raw || `HTTP ${r.status}`)
      }
      setQueuedJobs((prev) => {
        const queued = prev.filter((j) => j.status === 'queued')
        const nonQueued = prev.filter((j) => j.status !== 'queued')
        const item = queued.find((j) => j.id === jobId)
        if (!item) return prev
        const nextQueued = queued.filter((j) => j.id !== jobId)
        nextQueued.splice(target, 0, item)
        return [...nextQueued, ...nonQueued]
      })
    } catch (e: unknown) {
      setJobError(e instanceof Error ? e.message : t.queueActionFailed)
    }
  }

  function parseErrorDetail(raw: string): string {
    try {
      const j = JSON.parse(raw) as { detail?: unknown }
      if (typeof j.detail === 'string') return j.detail
    } catch {
      /* use raw */
    }
    return raw
  }

  async function pickOutputFolder() {
    setPickFolderError(null)
    setPickingFolder(true)
    try {
      const r = await fetch('/api/system/pick-folder', { method: 'POST' })
      const raw = await r.text()
      if (!r.ok) {
        throw new Error(parseErrorDetail(raw) || `HTTP ${r.status}`)
      }
      const data = JSON.parse(raw) as { path: string | null; cancelled: boolean }
      if (!data.cancelled && data.path) setOutputDir(data.path)
    } catch (e: unknown) {
      setPickFolderError(e instanceof Error ? e.message : t.folderPickerFailed)
    } finally {
      setPickingFolder(false)
    }
  }

  async function createSubfolderAndUse() {
    const parent = outputDir.trim()
    const name = subfolderName.trim()
    setSubfolderError(null)
    if (!parent) {
      setSubfolderError(t.selectOutputFirst)
      return
    }
    if (!name) {
      setSubfolderError(t.enterFolderName)
      return
    }
    setCreatingSubfolder(true)
    try {
      const r = await fetch('/api/system/mkdir-subfolder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_dir: parent, name }),
      })
      const raw = await r.text()
      if (!r.ok) {
        throw new Error(parseErrorDetail(raw) || `HTTP ${r.status}`)
      }
      const data = JSON.parse(raw) as { path: string }
      setOutputDir(data.path)
      setSubfolderName('')
    } catch (e: unknown) {
      setSubfolderError(e instanceof Error ? e.message : t.createFolderFailed)
    } finally {
      setCreatingSubfolder(false)
    }
  }

  async function startExtraction(e: React.FormEvent) {
    e.preventDefault()
    setJobError(null)
    if (files.length === 0) {
      setJobError(t.chooseAudio)
      return
    }
    const dir = outputDir.trim()
    if (!dir) {
      setJobError(t.enterOutputDir)
      return
    }
    setSubmitting(true)
    try {
      const created: QueuedJob[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('output_dir', dir)
        fd.append('locale', locale)
        fd.append('file', file)
        const r = await fetch('/api/jobs/', {
          method: 'POST',
          headers: { 'X-Client-Session': clientSessionId },
          body: fd,
        })
        if (!r.ok) {
          const raw = await r.text()
          throw new Error(raw || `HTTP ${r.status}`)
        }
        const data = (await r.json()) as { job_id: string; source_name: string }
        created.push({
          id: data.job_id,
          source_name: data.source_name,
          output_dir: dir,
          status: 'queued',
          phase: 'load_model',
          phase_percent: 0,
          overall_percent: 0,
          elapsed_sec: null,
          eta_sec: null,
          error: null,
          transcript_path: null,
        })
      }
      setQueuedJobs((prev) => [...created, ...prev])
      setFiles([])
      void loadUsage()
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : t.startFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <p className="tagline">{t.appTagline}</p>
        <button type="button" className="secondary language-toggle" onClick={() => setUiLang((v) => (v === 'en' ? 'es' : 'en'))}>
          {t.switchLanguage}
        </button>
      </header>

      <section className="panel">
        <h2>{t.extractTitle}</h2>
        <p className="muted small">
          {t.extractIntro}
        </p>
        <form className="form" onSubmit={startExtraction}>
          <div className="field-group" role="group" aria-labelledby="output-dir-label">
            <span id="output-dir-label" className="field-group-label">
              {t.outputDirectory}
            </span>
            <p className="muted small field-group-hint">
              {t.outputHint}
            </p>
            <label className="field field-nested">
              <span className="sr-only">{t.absolutePath}</span>
              <div className="field-row">
                <input
                  id="output-dir-path"
                  type="text"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="/path/to/transcript_app/data/transcripts"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Output directory absolute path"
                />
                <button
                  type="button"
                  className="secondary pick-folder"
                  disabled={!health || pickingFolder}
                  onClick={() => void pickOutputFolder()}
                >
                  {pickingFolder ? t.dialogOpen : t.selectFolder}
                </button>
              </div>
            </label>
            {pickFolderError && (
              <p className="err small" role="alert">
                {pickFolderError}
              </p>
            )}
            <label className="field field-nested">
              <span>{t.newSubfolder}</span>
              <div className="field-row">
                <input
                  type="text"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  placeholder={t.subfolderPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={creatingSubfolder}
                  aria-label="Name for new subfolder (single folder name, no slashes)"
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={!health || creatingSubfolder || !outputDir.trim()}
                  onClick={() => void createSubfolderAndUse()}
                >
                  {creatingSubfolder ? t.creating : t.createUse}
                </button>
              </div>
            </label>
            {subfolderError && (
              <p className="err small" role="alert">
                {subfolderError}
              </p>
            )}
          </div>
          <label className="field">
            <span>{t.audioFile}</span>
            <input
              type="file"
              multiple
              accept="audio/*,.aac,.m4a,.mp3,.wav,.flac,.ogg,.opus"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <label className="field">
            <span>{t.headerLocale}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as 'es' | 'en')}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
          <button type="submit" disabled={extractionInFlight || !health}>
            {submitting ? t.starting : t.startExtraction}
          </button>
        </form>
        {jobError && (
          <p className="err" role="alert">
            {jobError}
          </p>
        )}
        <div className="job-status" role="status">
          <div className="queue-header">
            <p>
              <strong>{t.processingQueue}</strong>
            </p>
            <div className="queue-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setQueueCompact((v) => !v)}
              >
                {queueCompact ? t.expandedQueue : t.compactQueue}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={clearCompletedJobs}
                disabled={!queuedJobs.some((j) => j.status === 'completed')}
              >
                {t.clearCompleted}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={clearFailedJobs}
                disabled={!queuedJobs.some((j) => j.status === 'failed')}
              >
                {t.clearFailed}
              </button>
            </div>
          </div>
          {queuedJobs.length === 0 && <p className="muted small">{t.queueEmpty}</p>}
          {queuedJobs.length > 0 && (
            <div className={`usage-runs ${queueCompact ? 'usage-runs--compact' : ''}`}>
              {queuedJobs.map((job) => (
                <article key={job.id} className="usage-run">
                  <p className="usage-run-head">
                    <code className="job-source-name" title={`Job id: ${job.id}`}>
                      {job.source_name}
                    </code>
                    <span className={`usage-run-status usage-run-status--${job.status}`}>{job.status}</span>
                  </p>
                  {job.status === 'queued' && (
                    <div className="queue-job-actions queue-detail">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void moveQueuedJob(job.id, -1)}
                        disabled={
                          queuedJobs.filter((j) => j.status === 'queued')[0]?.id === job.id
                        }
                      >
                        {t.moveUp}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void moveQueuedJob(job.id, 1)}
                        disabled={
                          queuedJobs.filter((j) => j.status === 'queued').at(-1)?.id === job.id
                        }
                      >
                        {t.moveDown}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void cancelQueuedJob(job.id)}
                      >
                        {t.cancelQueued}
                      </button>
                    </div>
                  )}
                  <p className="muted small queue-detail">
                    {t.queueOutputDir}: <code>{job.output_dir}</code>
                  </p>
                  <div className="queue-detail">
                    <PipelineStepIndicator
                    job={{
                      id: job.id,
                      source_name: job.source_name,
                      status: job.status,
                      phase: job.phase,
                      phase_percent: job.phase_percent,
                      overall_percent: job.overall_percent,
                      started_at: null,
                      elapsed_sec: job.elapsed_sec,
                      eta_sec: job.eta_sec,
                      error: job.error,
                      transcript_path: job.transcript_path,
                    }}
                    stepLabels={stepLabels}
                  />
                  </div>
                  {(job.status === 'queued' || job.status === 'running') && (
                    <p className="muted small pipeline-step-meta queue-detail">
                      {t.step} <code>{job.phase ?? '—'}</code> · {Math.round(job.phase_percent)}%{' '}
                      {t.inCurrentStep} · {t.overall} ~{Math.round(job.overall_percent)}% · {t.elapsed}{' '}
                      {formatDuration(job.elapsed_sec)}
                      {job.eta_sec != null && job.eta_sec > 0 && (
                        <> · {t.eta} ~{formatDuration(job.eta_sec)} ({t.estimate})</>
                      )}
                    </p>
                  )}
                  {job.status === 'completed' && job.transcript_path && (
                    <p className="ok queue-detail">
                      {t.wrote}{' '}
                      <a
                        href={transcriptFileUrl(job.output_dir, fileBasename(job.transcript_path))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.viewInNewTab}
                      </a>{' '}
                      <code>{job.transcript_path}</code>
                    </p>
                  )}
                  {job.status === 'failed' && job.error && (
                    <p className="err small queue-detail" role="alert">
                      {job.error}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
          {queuedJobs.some((j) => j.status === 'completed' || j.status === 'failed') && (
            <button type="button" className="secondary" onClick={dismissJobPanel}>
              {t.clearFinished}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>{t.recentActivity}</h2>
        {usageSummary && (
          <div className="usage-summary">
            <div className="usage-stat">
              <span className="usage-stat-label">{t.runs}</span>
              <strong>{usageSummary.total_runs}</strong>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">{t.completed}</span>
              <strong>{usageSummary.completed_runs}</strong>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">{t.failed}</span>
              <strong>{usageSummary.failed_runs}</strong>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">{t.sourceBytes}</span>
              <strong>{formatBytes(usageSummary.total_source_bytes)}</strong>
            </div>
            <div className="usage-stat">
              <span className="usage-stat-label">{t.processingTime}</span>
              <strong>{formatDuration(usageSummary.total_elapsed_sec)}</strong>
            </div>
          </div>
        )}
        {usageError && (
          <p className="err" role="alert">
            {usageError}
          </p>
        )}
        {!usageError && usageRuns.length === 0 && (
          <p className="muted">{t.noHistory}</p>
        )}
        {usageRuns.length > 0 && (
          <div className="usage-runs">
            {usageRuns.map((run) => (
              <article key={run.id} className="usage-run">
                <p className="usage-run-head">
                  <code className="job-source-name">{run.source_name}</code>
                  <span className={`usage-run-status usage-run-status--${run.status}`}>
                    {run.status}
                  </span>
                </p>
                <p className="muted small">
                  {t.size} {formatBytes(run.source_size_bytes)} · {t.processed} {formatDuration(run.elapsed_sec)} ·{' '}
                  {formatDateTime(run.completed_at)}
                </p>
                <p className="muted small">
                  {t.output}{' '}
                  {run.status === 'completed' && run.output_name ? (
                    <>
                      <a
                        href={transcriptFileUrl(run.output_dir, run.output_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.viewInNewTab}
                      </a>{' '}
                      <code>{run.output_name}</code>
                    </>
                  ) : run.output_name ? (
                    <code>{run.output_name}</code>
                  ) : (
                    '—'
                  )}
                </p>
                <p className="muted small">
                  {t.outputDir} <code>{run.output_dir}</code>
                </p>
                {run.output_path && (
                  <p className="muted small">
                    {t.outputPath} <code>{run.output_path}</code>
                  </p>
                )}
                {run.error_message && (
                  <p className="err small" role="alert">
                    {run.error_message}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        <button type="button" className="secondary" onClick={() => void loadUsage()}>
          {t.refreshActivity}
        </button>
      </section>

      <section className="panel">
        <h2>{t.completedTranscripts}</h2>
        <p className="muted small">
          {t.scansPattern} <code>*_transcript.txt</code> in the output directory above.
        </p>
        {listError && (
          <p className="err" role="alert">
            {listError}
          </p>
        )}
        {!outputDir.trim() && <p className="muted">{t.enterOutputToList}</p>}
        {outputDir.trim() && !listError && completed.length === 0 && (
          <p className="muted">{t.noTranscriptsYet}</p>
        )}
        {completed.length > 0 && (
          <ul className="file-list">
            {completed.map((item) => (
              <li key={item.path}>
                <a
                  className="file-name"
                  href={transcriptFileUrl(outputDir, item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.name}
                </a>
                <span className="muted small">
                  {(item.size_bytes / 1024).toFixed(1)} KiB
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="secondary" onClick={() => void loadCompleted()}>
          {t.refreshList}
        </button>
      </section>
    </div>
  )
}

export default App
