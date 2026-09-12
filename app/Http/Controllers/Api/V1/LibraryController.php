<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\RoleEnum;
use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookLoan;
use App\Models\Student;
use App\Services\LibraryService;
use App\Services\SearchService;
use App\Support\SignedDownload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LibraryController extends Controller
{
    public function __construct(
        protected LibraryService $service,
        protected SearchService $search,
    ) {}

    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:128'],
            'category' => ['nullable', 'string', 'max:64'],
        ]);

        // Meili = optimasi: bila tidak terjangkau (null) jatuh ke query DB biasa.
        $ids = $this->search->searchBooks($data['search'] ?? null, $data['category'] ?? null);

        $books = Book::query()
            ->withCount(['loans as borrowed_count' => fn ($q) => $q->where('status', 'borrowed')])
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids ?: ['__none__']))
            ->when($ids === null, fn ($q) => $q->when(
                $data['search'] ?? null,
                fn ($w, $s) => $w->where(fn ($x) => $x
                    ->whereRaw('LOWER(title) LIKE ?', ['%'.strtolower($s).'%'])
                    ->orWhereRaw('LOWER(author) LIKE ?', ['%'.strtolower($s).'%'])
                    ->orWhere('isbn', $s))
            ))
            ->when($data['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->orderBy('title')
            ->paginate(25)
            // E-book: link bertanda tangan berumur pendek, bukan path mentah.
            ->through(function (Book $book) {
                $book->setAttribute(
                    'ebook_url',
                    $book->has_ebook ? SignedDownload::url('library.ebook', ['book' => $book->id]) : null
                );

                return $book;
            });

        return $this->envelope($request, $books);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('manageLibrary', Book::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'author' => ['required', 'string', 'max:255'],
            'publisher' => ['nullable', 'string', 'max:255'],
            'isbn' => ['nullable', 'string', 'max:32', 'unique:books,isbn'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'category' => ['nullable', 'string', 'max:64'],
            'physical_stock' => ['nullable', 'integer', 'min:0'],
            'page_count' => ['nullable', 'integer', 'min:1'],
            'summary' => ['nullable', 'string'],
            'ebook' => ['nullable', 'file', 'max:51200', 'mimes:pdf'],
        ]);

        $ebookPath = null;
        if ($request->hasFile('ebook')) {
            $ebookPath = $request->file('ebook')->store('library/ebooks', 'local');
        }

        return $this->envelope($request, Book::create([
            ...collect($data)->except('ebook')->all(),
            'ebook_path' => $ebookPath,
        ]), 201);
    }

    public function borrow(Request $request, Book $book): JsonResponse
    {
        $this->authorize('borrowBook', Book::class);

        $data = $request->validate([
            'student_id' => ['sometimes', 'string', 'exists:students,id'],
            'days' => ['nullable', 'integer', 'min:1', 'max:60'],
        ]);

        // Otorisasi horizontal: akun siswa selalu meminjam atas nama dirinya —
        // `student_id` dari klien diabaikan agar siswa A tidak bisa meminjam
        // (dan menghabiskan kuota) atas nama siswa B.
        if ($request->user()->hasRole(RoleEnum::Siswa->value)) {
            $studentId = $request->user()->student?->id;

            if (! $studentId) {
                abort(422, 'Akun siswa belum tertaut ke data siswa. Hubungi admin.');
            }
        } else {
            $studentId = $data['student_id'] ?? null;

            if (! $studentId) {
                abort(422, 'student_id wajib diisi.');
            }
        }

        return $this->envelope(
            $request,
            $this->service->borrow($book, Student::findOrFail($studentId), (int) ($data['days'] ?? 14)),
            201
        );
    }

    public function giveBack(Request $request, BookLoan $loan): JsonResponse
    {
        $this->authorize('manageLibrary', Book::class);

        return $this->envelope($request, $this->service->giveBack($loan));
    }

    /** Daftar pinjaman (petugas) — dipakai panel pengembalian. */
    public function loans(Request $request): JsonResponse
    {
        $this->authorize('manageLibrary', Book::class);

        $data = $request->validate([
            'status' => ['nullable', 'in:borrowed,returned,late'],
        ]);

        $loans = BookLoan::with(['book:id,title', 'student:id,nisn,name'])
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('borrowed_at')
            ->paginate(50);

        return $this->envelope($request, $loans);
    }

    public function ebook(Request $request, Book $book)
    {
        // E-book hanya untuk komunitas sekolah aktif (bukan calon siswa).
        $this->authorize('viewEbook', Book::class);

        if (! $book->ebook_path) {
            abort(404, 'E-book tidak tersedia.');
        }

        return Storage::disk('local')->download($book->ebook_path, $book->title.'.pdf');
    }
}
