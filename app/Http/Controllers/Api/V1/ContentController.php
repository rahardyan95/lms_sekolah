<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Support\CmsHtmlSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentController extends Controller
{
    private function envelope(Request $request, mixed $data, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $data, 'meta' => null, 'errors' => null,
            'request_id' => $request->header('X-Request-ID', (string) str()->ulid()),
        ], $status);
    }

    public function index(): JsonResponse
    {
        $posts = Post::query()
            ->where('status', 'published')
            ->orderByDesc('published_at')
            ->paginate(12);

        return response()->json([
            'data' => $posts, 'meta' => null, 'errors' => null,
            'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $post = Post::where('slug', $slug)->where('status', 'published')->firstOrFail();

        return response()->json([
            'data' => $post, 'meta' => null, 'errors' => null,
            'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('manageCms', Post::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'content' => ['required', 'string'],
            'image_url' => ['nullable', 'url', 'max:512'],
            'tags' => ['nullable', 'array', 'max:10'],
            'tags.*' => ['string', 'max:32'],
            'status' => ['nullable', 'in:'.implode(',', Post::STATUSES)],
        ]);

        $status = $data['status'] ?? Post::STATUS_DRAFT;

        return $this->envelope($request, Post::createWithUniqueSlug([
            ...$data,
            'content' => (string) CmsHtmlSanitizer::clean($data['content']),
            'status' => $status,
            'published_at' => $status === Post::STATUS_PUBLISHED ? now() : null,
            'author_id' => $request->user()->id,
        ]), 201);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        $this->authorize('manageCms', Post::class);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'content' => ['sometimes', 'string'],
            'image_url' => ['nullable', 'url', 'max:512'],
            'tags' => ['nullable', 'array', 'max:10'],
            'status' => ['sometimes', 'in:'.implode(',', Post::STATUSES)],
        ]);

        if (array_key_exists('content', $data)) {
            $data['content'] = (string) CmsHtmlSanitizer::clean($data['content']);
        }

        if (($data['status'] ?? $post->status) === Post::STATUS_PUBLISHED && ! $post->published_at) {
            $data['published_at'] = now();
        }

        $post->update($data);

        return $this->envelope($request, $post->refresh());
    }

    /** Daftar semua status untuk panel CMS (bukan hanya published). */
    public function manage(Request $request): JsonResponse
    {
        $this->authorize('manageCms', Post::class);

        $data = $request->validate([
            'status' => ['nullable', 'in:'.implode(',', Post::STATUSES)],
            'category' => ['nullable', 'string', 'max:64'],
            'search' => ['nullable', 'string', 'max:128'],
        ]);

        $posts = Post::query()
            ->when($data['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($data['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when($data['search'] ?? null, fn ($q, $s) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.strtolower($s).'%']))
            ->orderByDesc('created_at')
            ->paginate(25);

        return $this->envelope($request, $posts);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $this->authorize('manageCms', Post::class);
        $post->delete();

        return $this->envelope($request, ['message' => 'Postingan dihapus.']);
    }
}
