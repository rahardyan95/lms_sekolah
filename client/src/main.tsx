import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import { CbtExamSecurityService } from './services/CbtExamService'

// Guard DEV: answer key CBT tidak boleh ada di data demo yang ikut bundle.
// Di produksi berkas mock tidak ikut ter-bundle, jadi guard ini tidak berlaku.
if (import.meta.env.DEV) {
  void import('./data/mockData').then(({ mockCbtExams }) => {
    CbtExamSecurityService.assertNoKeysInProd(mockCbtExams)
  })
}

// Error tracking: aktif hanya bila VITE_SENTRY_DSN diisi (staging/prod).
// Tanpa PII: tidak ada user context; sampling kecil.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
  })
}

// PWA: hanya di build produksi (dev tidak perlu cache shell dan akan
// menyulitkan HMR). Shell read-only — data akademik tidak pernah di-cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registrasi gagal (mis. CSP/HTTP non-secure): aplikasi tetap jalan */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
