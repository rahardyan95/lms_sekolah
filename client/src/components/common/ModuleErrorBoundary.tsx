import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ModuleErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * OOP ErrorBoundary untuk lazy modules (code-splitting).
 * Chunk gagal dimuat (deploy baru / jaringan) → tampilkan fallback
 * dengan tombol muat ulang, bukan blank screen.
 * Error juga dikirim ke Sentry (aktif hanya bila VITE_SENTRY_DSN diisi).
 */
export class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): ModuleErrorBoundaryState {
    return { hasError: true, message: err instanceof Error ? err.message : 'Gagal memuat modul.' };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    Sentry.captureException(error, {
      tags: { source: 'lazy-module' },
      extra: { componentStack: info.componentStack },
    });
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800" role="alert">
        <p className="font-bold">Modul gagal dimuat</p>
        <p className="mt-1 opacity-80">{this.state.message || 'Periksa koneksi, lalu muat ulang.'}</p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-3 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
        >
          Muat Ulang
        </button>
      </div>
    );
  }
}
