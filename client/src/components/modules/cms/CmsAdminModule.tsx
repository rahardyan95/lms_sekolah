import React, { useEffect, useState } from 'react';
import { Globe, Plus, Pencil, Trash2, RefreshCw, FileText } from 'lucide-react';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { CmsApiService, type ServerPost, type CmsPostInput } from '../../../services/OpsApiService';

interface CmsAdminModuleProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const;

type PostStatus = (typeof STATUS_OPTIONS)[number]['value'];

const statusVariant = (status: string | undefined): 'success' | 'warning' | 'info' | 'neutral' => {
  switch (status) {
    case 'published':
      return 'success';
    case 'review':
      return 'warning';
    case 'archived':
      return 'info';
    default:
      return 'neutral';
  }
};

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const emptyForm = {
  title: '',
  category: '',
  excerpt: '',
  content: '',
  tags: '',
  image_url: '',
  status: 'draft' as PostStatus,
};

/** Panel admin CMS: kelola berita/artikel (semua status) — entitas `posts`. */
export const CmsAdminModule: React.FC<CmsAdminModuleProps> = ({ onShowToast }) => {
  const [posts, setPosts] = useState<ServerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [refresh, setRefresh] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void CmsApiService.adminPosts(statusFilter ? { status: statusFilter } : undefined)
      .then((list) => {
        if (cancelled) return;
        setPosts(list);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, refresh]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (post: ServerPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      category: post.category ?? '',
      excerpt: post.excerpt ?? '',
      content: post.content ?? '',
      tags: (post.tags ?? []).join(', '),
      image_url: post.image_url ?? '',
      status: (STATUS_OPTIONS.some((o) => o.value === post.status) ? post.status : 'draft') as PostStatus,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      onShowToast('Data Belum Lengkap', 'Judul dan konten wajib diisi.', 'warning');
      return;
    }

    const payload: CmsPostInput = {
      title,
      content,
      status: form.status,
      category: form.category.trim() || undefined,
      excerpt: form.excerpt.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await CmsApiService.updatePost(editingId, payload);
        onShowToast('Berita Diperbarui', `"${title}" tersimpan.`, 'success');
      } else {
        await CmsApiService.createPost(payload);
        onShowToast('Berita Dibuat', `"${title}" tersimpan.`, 'success');
      }
      setModalOpen(false);
      setRefresh((n) => n + 1);
    } catch {
      onShowToast(
        editingId ? 'Gagal Memperbarui' : 'Gagal Menyimpan',
        'Server menolak data berita ini.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (post: ServerPost) => {
    setDeletingId(post.id);
    try {
      await CmsApiService.deletePost(post.id);
      onShowToast('Berita Dihapus', `"${post.title}" telah dihapus.`, 'success');
      setRefresh((n) => n + 1);
    } catch {
      onShowToast('Gagal Menghapus', 'Server tidak merespons permintaan ini.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="cms-admin-module">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-600" />
            <span>Kelola CMS &amp; Berita Sekolah</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tulis, tinjau, dan terbitkan berita/artikel website sekolah dari satu panel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefresh((n) => n + 1)}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Muat ulang daftar"
            aria-label="Muat ulang daftar berita"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors flex items-center gap-1.5"
            data-testid="btn-create-post"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Berita</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="filter-cms-status" className="text-xs font-semibold text-slate-600">
            Status
          </label>
          <select
            id="filter-cms-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="select-cms-status-filter"
          >
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <span className="px-3.5 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold font-mono">
          TOTAL: {posts.length} BERITA
        </span>
      </div>

      {/* Posts Table */}
      {loadError ? (
        <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center" data-testid="cms-admin-error">
          <p className="text-sm font-semibold text-rose-700">Gagal memuat daftar berita</p>
          <p className="text-xs text-slate-500 mt-1">
            Sesi Anda mungkin tidak memiliki hak kelola CMS, atau server sedang tidak dapat dihubungi.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto border border-slate-200 rounded-xl bg-white"
          tabIndex={0}
          role="region"
          aria-label="Tabel data (geser horizontal bila perlu)"
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Judul</th>
                <th className="p-3.5">Kategori</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Terbit</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50/80">
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900 line-clamp-1">{post.title}</p>
                    <p className="text-[11px] font-mono text-slate-500">{post.slug}</p>
                  </td>
                  <td className="p-3.5 text-slate-600">{post.category ?? '—'}</td>
                  <td className="p-3.5">
                    <Badge variant={statusVariant(post.status)}>{post.status ?? 'draft'}</Badge>
                  </td>
                  <td className="p-3.5 text-slate-600 font-mono">{formatDate(post.published_at)}</td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(post)}
                        className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg hover:bg-slate-100"
                        title="Ubah berita"
                        data-testid={`btn-edit-post-${post.id.slice(0, 8)}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                        title="Hapus berita"
                        data-testid={`btn-delete-post-${post.id.slice(0, 8)}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && posts.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              <FileText className="w-8 h-8 mx-auto text-slate-300" />
              <p className="mt-2 text-xs font-semibold">Belum ada berita untuk filter ini.</p>
            </div>
          )}

          {loading && (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">Memuat berita…</div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Ubah Berita' : 'Tulis Berita Baru'}
        subtitle="Konten akan disanitasi oleh server sebelum disimpan."
        maxWidth="2xl"
        dataTestId="modal-cms-post"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              data-testid="input-cms-title"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="cth. berita, galeri, banner"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="input-cms-category"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PostStatus })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                data-testid="input-cms-status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ringkasan</label>
            <input
              type="text"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="input-cms-excerpt"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Konten</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              data-testid="input-cms-content"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tag (pisahkan dengan koma)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="prestasi, akademik"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="input-cms-tags"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">URL Gambar</label>
              <input
                type="url"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="input-cms-image-url"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
              data-testid="btn-save-post"
            >
              {isSaving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
