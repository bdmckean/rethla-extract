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

type SpeakersResponse = {
  speakers: string[]
}

type RenameSpeakersResponse = {
  name: string
  path: string
}

type AuthUser = {
  id: string
  email: string
  role: string
  status: string
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

type UiCopy = Record<string, string>

const UI_STRINGS: Record<UiLang, UiCopy> = {
  en: {
    appTitle: 'Transcript App',
    appTagline: 'Speaker-attributed transcripts from audio',
    switchLanguage: 'ES',
    navHome: 'Home',
    navApp: 'Open app',
    authTitle: 'Sign in',
    authIntro: 'Create an account or sign in to use jobs, queue history, and user-scoped activity.',
    authEmail: 'Email',
    authPassword: 'Password',
    authLogin: 'Sign in',
    authRegister: 'Create account',
    authSwitchToRegister: "Don't have an account? Create one",
    authSwitchToLogin: 'Already have an account? Sign in',
    authSigningIn: 'Signing in...',
    authCreating: 'Creating account...',
    authLogout: 'Sign out',
    authRequired: 'Sign in required',
    authWelcome: 'Signed in as',
    authFailed: 'Authentication failed',
    homeHeroTitle: 'Transcription runs on hardware you control',
    homeHeroLead:
      'Upload audio to your local API, pick an output folder, and download speaker-labeled transcripts. This page summarizes how data flows and what you need to run the stack.',
    homeHowToTitle: 'How to use the service',
    homeHowToLi1:
      'Start the backend on the machine that will process audio (from the backend directory, e.g. run the API on 127.0.0.1:8000 per the backend README).',
    homeHowToLi2:
      'Start the web UI (e.g. npm run dev in the frontend folder) and open it in the browser. In development, requests to /api are proxied to the backend.',
    homeHowToLi3:
      'Click Open app (or add #app to the URL). Set Output directory to an absolute path on the API host where transcripts should be saved. Use Select folder when the native picker is available (local development).',
    homeHowToLi4:
      'Optionally enter a subfolder name and use Create & use to write outputs inside that folder.',
    homeHowToLi5:
      'Choose one or more audio files and pick the header locale (Spanish or English labels in the transcript text).',
    homeHowToLi6:
      'Click Start extraction. Jobs appear in the processing queue and run one after another. You can compact or expand the queue, reorder or cancel queued jobs, and clear completed or failed entries.',
    homeHowToLi7:
      'When processing finishes, open the transcript from the job row, from Completed transcripts, or from Recent activity. Use Assign speaker names on a listed file to save an extra copy with your custom speaker names.',
    homeHowToLi8:
      'Leave the API running until jobs finish. If the API restarts, active job state may be lost; refresh the completed list or activity after long runs.',
    homePrivacyTitle: 'Privacy and your data',
    homePrivacyP1:
      'In the default local setup, audio you select is sent from the browser to the FastAPI backend you run (typically at http://127.0.0.1:8000). Processing happens on that same machine. Transcripts, checkpoints, and logs are written only to paths you configure (output directory, local database file, temp uploads on the API host).',
    homePrivacyP2:
      'The UI stores a browser session id (in localStorage) and may record basic usage metadata (e.g. run history) in a SQLite database on the API host, keyed to that session. Clear site data or use a private window if you want to reset the browser-side identifier.',
    homePrivacyP3:
      'This default configuration is not a multi-tenant cloud SaaS: your audio is not sent to a third-party transcription API unless you change the deployment. An internet-hosted product will publish separate Terms of Service and Privacy Policy and acceptance flows (see product PRD).',
    homePrivacyP4:
      'You are responsible for securing the machine, the network path to the API, backups, and any folders that contain audio or transcripts.',
    homeReqTitle: 'System requirements (local development)',
    homeReqLi1: 'Current desktop browser (recent Chrome, Firefox, Safari, or Edge).',
    homeReqLi2:
      'FastAPI backend running and reachable (default http://127.0.0.1:8000; Vite dev server proxies /api to it).',
    homeReqLi3: 'macOS, Windows, or Linux on the machine that runs the Python stack.',
    homeReqLi4: 'Python environment per backend README (uv recommended); WhisperX / PyTorch dependencies installed.',
    homeReqLi5: 'RAM: at least 8 GB for lighter models; 16 GB or more recommended; large Whisper models need more headroom.',
    homeReqLi6:
      'GPU: optional; NVIDIA + CUDA typically speeds processing on Linux. On macOS, CPU or Apple Silicon acceleration depends on your build; GPU inside Docker on Mac is often impractical.',
    homeReqLi7: 'ffmpeg available for audio decoding (as required by the underlying stack).',
    homeReqLi8: 'Hugging Face token where diarization models require it (see backend documentation).',
    homeReqLi9: 'Free disk space for model weights, temporary uploads, and transcript outputs.',
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
    assignSpeakers: 'Assign speaker names',
    speakerNames: 'Speaker names',
    saveSpeakerNames: 'Create named transcript',
    loadingSpeakers: 'Loading speakers...',
    noSpeakersDetected: 'No speaker labels detected in this transcript.',
    speakerNamePlaceholder: 'Enter name',
    renameSpeakersFailed: 'Could not save speaker names',
    renamedTranscriptSaved: 'Saved named transcript',
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
    navHome: 'Inicio',
    navApp: 'Abrir aplicación',
    authTitle: 'Iniciar sesión',
    authIntro:
      'Crea una cuenta o inicia sesión para usar trabajos, historial de cola y actividad asociada al usuario.',
    authEmail: 'Correo',
    authPassword: 'Contraseña',
    authLogin: 'Entrar',
    authRegister: 'Crear cuenta',
    authSwitchToRegister: '¿No tienes cuenta? Créala',
    authSwitchToLogin: '¿Ya tienes cuenta? Inicia sesión',
    authSigningIn: 'Entrando...',
    authCreating: 'Creando cuenta...',
    authLogout: 'Cerrar sesión',
    authRequired: 'Inicio de sesión requerido',
    authWelcome: 'Sesión iniciada como',
    authFailed: 'Falló la autenticación',
    homeHeroTitle: 'La transcripción se ejecuta en equipos que tú controlas',
    homeHeroLead:
      'Sube audio a tu API local, elige una carpeta de salida y obtén transcripciones con hablantes. Esta página resume cómo circulan los datos y qué necesitas para ejecutar el sistema.',
    homeHowToTitle: 'Cómo usar el servicio',
    homeHowToLi1:
      'Inicia el backend en la máquina que procesará el audio (desde la carpeta del backend, p. ej. API en 127.0.0.1:8000 según el README).',
    homeHowToLi2:
      'Inicia la interfaz web (p. ej. npm run dev en la carpeta frontend) y ábrela en el navegador. En desarrollo, las peticiones a /api se envían al backend mediante el proxy.',
    homeHowToLi3:
      'Pulsa Abrir aplicación (o añade #app a la URL). Indica el directorio de salida: una ruta absoluta en el host de la API donde guardar las transcripciones. Usa Seleccionar carpeta cuando haya selector nativo (desarrollo local).',
    homeHowToLi4:
      'Opcionalmente escribe el nombre de una subcarpeta y usa Crear y usar para escribir las salidas dentro de esa carpeta.',
    homeHowToLi5:
      'Elige uno o más archivos de audio y el idioma del encabezado (etiquetas en español o inglés en el texto de la transcripción).',
    homeHowToLi6:
      'Pulsa Iniciar extracción. Los trabajos aparecen en la cola y se ejecutan uno tras otro. Puedes compactar o expandir la cola, reordenar o cancelar trabajos en cola, y quitar completados o fallidos.',
    homeHowToLi7:
      'Al terminar, abre la transcripción desde la fila del trabajo, desde Transcripciones completadas o desde Actividad reciente. Usa Asignar nombres de hablantes en un archivo listado para guardar una copia adicional con tus nombres.',
    homeHowToLi8:
      'Mantén la API en ejecución hasta que terminen los trabajos. Si la API se reinicia, el estado de trabajos activos puede perderse; actualiza el listado o la actividad tras procesos largos.',
    homePrivacyTitle: 'Privacidad y tus datos',
    homePrivacyP1:
      'En la configuración local habitual, el audio que eliges se envía desde el navegador al backend FastAPI que tú ejecutas (normalmente en http://127.0.0.1:8000). El procesamiento ocurre en esa misma máquina. Las transcripciones, puntos de control y registros se escriben solo en rutas que configures (directorio de salida, base de datos local, cargas temporales en el host de la API).',
    homePrivacyP2:
      'La interfaz guarda un id de sesión del navegador (en localStorage) y puede registrar metadatos básicos de uso (p. ej. historial de ejecuciones) en una base SQLite en el host de la API, asociados a esa sesión. Borra los datos del sitio o usa una ventana privada si quieres restablecer el identificador del navegador.',
    homePrivacyP3:
      'Esta configuración por defecto no es un SaaS multicliente en la nube: tu audio no se envía a una API de transcripción de terceros salvo que cambies el despliegue. Un producto alojado en Internet publicará Condiciones del servicio y Política de privacidad distintas y flujos de aceptación (véase el PRD del producto).',
    homePrivacyP4:
      'Eres responsable de asegurar el equipo, la ruta de red hacia la API, las copias de seguridad y las carpetas que contengan audio o transcripciones.',
    homeReqTitle: 'Requisitos del sistema (desarrollo local)',
    homeReqLi1: 'Navegador de escritorio actual (Chrome, Firefox, Safari o Edge recientes).',
    homeReqLi2:
      'Backend FastAPI en ejecución y accesible (por defecto http://127.0.0.1:8000; el servidor de desarrollo Vite enruta /api hacia él).',
    homeReqLi3: 'macOS, Windows o Linux en la máquina que ejecuta la pila de Python.',
    homeReqLi4: 'Entorno Python según el README del backend (se recomienda uv); dependencias WhisperX / PyTorch instaladas.',
    homeReqLi5: 'RAM: al menos 8 GB para modelos ligeros; 16 GB o más recomendados; los modelos Whisper grandes necesitan más margen.',
    homeReqLi6:
      'GPU: opcional; NVIDIA + CUDA suele acelerar el proceso en Linux. En macOS, CPU o aceleración en Apple Silicon depende de tu build; la GPU dentro de Docker en Mac suele ser poco práctica.',
    homeReqLi7: 'ffmpeg disponible para decodificación de audio (según lo requiera la pila subyacente).',
    homeReqLi8: 'Token de Hugging Face cuando los modelos de diarización lo exijan (véase la documentación del backend).',
    homeReqLi9: 'Espacio en disco para pesos del modelo, cargas temporales y transcripciones de salida.',
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
    assignSpeakers: 'Asignar nombres de hablantes',
    speakerNames: 'Nombres de hablantes',
    saveSpeakerNames: 'Crear transcripción con nombres',
    loadingSpeakers: 'Cargando hablantes...',
    noSpeakersDetected: 'No se detectaron etiquetas de hablante en esta transcripción.',
    speakerNamePlaceholder: 'Escribe un nombre',
    renameSpeakersFailed: 'No se pudieron guardar los nombres de hablantes',
    renamedTranscriptSaved: 'Transcripción con nombres guardada',
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

function routeFromHash(): 'home' | 'app' {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'app' ? 'app' : 'home'
}

function HomeView({ t, onOpenApp }: { t: UiCopy; onOpenApp: () => void }) {
  const howToSteps = [
    t.homeHowToLi1,
    t.homeHowToLi2,
    t.homeHowToLi3,
    t.homeHowToLi4,
    t.homeHowToLi5,
    t.homeHowToLi6,
    t.homeHowToLi7,
    t.homeHowToLi8,
  ]
  const privacyBlocks = [t.homePrivacyP1, t.homePrivacyP2, t.homePrivacyP3, t.homePrivacyP4]
  const reqItems = [
    t.homeReqLi1,
    t.homeReqLi2,
    t.homeReqLi3,
    t.homeReqLi4,
    t.homeReqLi5,
    t.homeReqLi6,
    t.homeReqLi7,
    t.homeReqLi8,
    t.homeReqLi9,
  ]
  return (
    <main className="home-page">
      <section className="panel home-hero">
        <h2>{t.homeHeroTitle}</h2>
        <p className="muted home-lead">{t.homeHeroLead}</p>
        <button type="button" className="home-cta" onClick={onOpenApp}>
          {t.navApp}
        </button>
      </section>
      <section className="panel home-section">
        <h2>{t.homeHowToTitle}</h2>
        <ol className="home-howto-list">
          {howToSteps.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </section>
      <section className="panel home-section">
        <h2>{t.homePrivacyTitle}</h2>
        {privacyBlocks.map((p, i) => (
          <p key={i} className="muted small home-prose">
            {p}
          </p>
        ))}
      </section>
      <section className="panel home-section">
        <h2>{t.homeReqTitle}</h2>
        <ul className="home-req-list">
          {reqItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  )
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
  const [mainRoute, setMainRoute] = useState<'home' | 'app'>(() => routeFromHash())
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authBusy, setAuthBusy] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  const goHome = () => {
    window.location.hash = ''
  }
  const goApp = () => {
    window.location.hash = 'app'
  }

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

  useEffect(() => {
    let cancelled = false
    const loadMe = async () => {
      try {
        const r = await fetch('/api/auth/me')
        if (!r.ok) {
          if (!cancelled) setAuthUser(null)
          return
        }
        const me = (await r.json()) as AuthUser
        if (!cancelled) setAuthUser(me)
      } catch {
        if (!cancelled) setAuthUser(null)
      } finally {
        if (!cancelled) setAuthBusy(false)
      }
    }
    void loadMe()
    return () => {
      cancelled = true
    }
  }, [])

  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [queueCompact, setQueueCompact] = useState(false)
  const [speakerEditorFile, setSpeakerEditorFile] = useState<string | null>(null)
  const [speakerLabels, setSpeakerLabels] = useState<string[]>([])
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({})
  const [speakerEditBusy, setSpeakerEditBusy] = useState(false)
  const [speakerEditError, setSpeakerEditError] = useState<string | null>(null)
  const [speakerEditSuccess, setSpeakerEditSuccess] = useState<string | null>(null)

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
    const onHash = () => setMainRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    setSpeakerEditorFile(null)
    setSpeakerLabels([])
    setSpeakerNames({})
    setSpeakerEditError(null)
    setSpeakerEditSuccess(null)
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

  async function openSpeakerEditor(fileName: string) {
    const dir = outputDir.trim()
    if (!dir) return
    setSpeakerEditError(null)
    setSpeakerEditSuccess(null)
    setSpeakerEditBusy(true)
    setSpeakerEditorFile(fileName)
    try {
      const q = new URLSearchParams({ output_dir: dir, name: fileName })
      const r = await fetch(`/api/output/speakers?${q}`)
      if (!r.ok) {
        const raw = await r.text()
        throw new Error(raw || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as SpeakersResponse
      setSpeakerLabels(data.speakers)
      setSpeakerNames(Object.fromEntries(data.speakers.map((label) => [label, ''])))
    } catch (e: unknown) {
      setSpeakerEditError(e instanceof Error ? e.message : t.renameSpeakersFailed)
      setSpeakerLabels([])
      setSpeakerNames({})
      setSpeakerEditorFile(null)
    } finally {
      setSpeakerEditBusy(false)
    }
  }

  async function saveSpeakerNames() {
    const dir = outputDir.trim()
    if (!dir || !speakerEditorFile) return
    setSpeakerEditError(null)
    setSpeakerEditSuccess(null)
    setSpeakerEditBusy(true)
    try {
      const r = await fetch('/api/output/rename-speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_dir: dir,
          name: speakerEditorFile,
          names: speakerNames,
        }),
      })
      if (!r.ok) {
        const raw = await r.text()
        throw new Error(raw || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as RenameSpeakersResponse
      setSpeakerEditSuccess(`${t.renamedTranscriptSaved}: ${data.name}`)
      await loadCompleted()
    } catch (e: unknown) {
      setSpeakerEditError(e instanceof Error ? e.message : t.renameSpeakersFailed)
    } finally {
      setSpeakerEditBusy(false)
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

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    try {
      const r = await fetch(authMode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const raw = await r.text()
      if (!r.ok) {
        throw new Error(parseErrorDetail(raw) || `HTTP ${r.status}`)
      }
      const me = JSON.parse(raw) as AuthUser
      setAuthUser(me)
      setAuthPassword('')
      setAuthError(null)
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : t.authFailed)
    }
  }

  async function logoutAuth() {
    setAuthError(null)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setAuthUser(null)
      setQueuedJobs([])
      setUsageRuns([])
      setUsageSummary(null)
    }
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
        <div className="app-header-row">
          <div className="app-header-titles">
            <h1>{t.appTitle}</h1>
            <p className="tagline">{t.appTagline}</p>
          </div>
          <div className="app-header-actions">
            {authUser && <span className="muted small">{t.authWelcome} <code>{authUser.email}</code></span>}
            {mainRoute === 'app' ? (
              <button type="button" className="secondary" onClick={goHome}>
                {t.navHome}
              </button>
            ) : (
              <button type="button" onClick={goApp}>
                {t.navApp}
              </button>
            )}
            {authUser && (
              <button type="button" className="secondary" onClick={() => void logoutAuth()}>
                {t.authLogout}
              </button>
            )}
            <button
              type="button"
              className="secondary language-toggle language-toggle--inline"
              onClick={() => setUiLang((v) => (v === 'en' ? 'es' : 'en'))}
            >
              {t.switchLanguage}
            </button>
          </div>
        </div>
      </header>

      {mainRoute === 'home' ? (
        <HomeView t={t} onOpenApp={goApp} />
      ) : authBusy ? (
        <section className="panel">
          <h2>{t.authTitle}</h2>
          <p className="muted small">{t.authSigningIn}</p>
        </section>
      ) : !authUser ? (
        <section className="panel">
          <h2>{t.authTitle}</h2>
          <p className="muted small">{t.authIntro}</p>
          <form className="form" onSubmit={submitAuth}>
            <label className="field">
              <span>{t.authEmail}</span>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>{t.authPassword}</span>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </label>
            {authError && (
              <p className="err small" role="alert">
                {authError}
              </p>
            )}
            <button type="submit">{authMode === 'login' ? t.authLogin : t.authRegister}</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setAuthMode((m) => (m === 'login' ? 'register' : 'login'))}
            >
              {authMode === 'login' ? t.authSwitchToRegister : t.authSwitchToLogin}
            </button>
          </form>
        </section>
      ) : (
        <>
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
                <div className="file-list-main">
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
                </div>
                <button
                  type="button"
                  className="secondary small-btn"
                  onClick={() => void openSpeakerEditor(item.name)}
                  disabled={speakerEditBusy}
                >
                  {t.assignSpeakers}
                </button>
              </li>
            ))}
          </ul>
        )}
        {speakerEditorFile && (
          <div className="speaker-editor">
            <p className="small">
              {t.speakerNames} · <code>{speakerEditorFile}</code>
            </p>
            {speakerEditBusy && <p className="muted small">{t.loadingSpeakers}</p>}
            {!speakerEditBusy && speakerLabels.length === 0 && (
              <p className="muted small">{t.noSpeakersDetected}</p>
            )}
            {!speakerEditBusy &&
              speakerLabels.map((label) => (
                <label key={label} className="speaker-row">
                  <code>{label}</code>
                  <input
                    type="text"
                    value={speakerNames[label] ?? ''}
                    onChange={(e) =>
                      setSpeakerNames((prev) => ({ ...prev, [label]: e.target.value }))
                    }
                    placeholder={t.speakerNamePlaceholder}
                  />
                </label>
              ))}
            {speakerEditError && (
              <p className="err small" role="alert">
                {speakerEditError}
              </p>
            )}
            {speakerEditSuccess && <p className="ok small">{speakerEditSuccess}</p>}
            <div className="queue-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSpeakerEditorFile(null)
                  setSpeakerLabels([])
                  setSpeakerNames({})
                  setSpeakerEditError(null)
                  setSpeakerEditSuccess(null)
                }}
                disabled={speakerEditBusy}
              >
                {t.dismissJob}
              </button>
              <button
                type="button"
                onClick={() => void saveSpeakerNames()}
                disabled={speakerEditBusy || speakerLabels.length === 0}
              >
                {t.saveSpeakerNames}
              </button>
            </div>
          </div>
        )}
        <button type="button" className="secondary" onClick={() => void loadCompleted()}>
          {t.refreshList}
        </button>
      </section>
        </>
      )}
    </div>
  )
}

export default App
