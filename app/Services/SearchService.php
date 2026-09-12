<?php

namespace App\Services;

use App\Models\Book;
use Meilisearch\Client;
use Throwable;

/**
 * Pencarian katalog via Meilisearch. Meili adalah optimasi, bukan sumber
 * kebenaran: bila tidak terjangkau, `searchBooks` mengembalikan null dan
 * pemanggil jatuh ke query DB yang sudah ada. Pengindeksan tidak boleh
 * menggagalkan penyimpanan buku — kegagalan ditelan dan dicatat.
 */
class SearchService
{
    public const INDEX = 'books';

    /** Host kosong = pencarian Meili dimatikan (mis. suite test hermetik). */
    private function enabled(): bool
    {
        return (string) config('services.meilisearch.host') !== '';
    }

    private function client(): Client
    {
        return new Client(
            (string) config('services.meilisearch.host'),
            (string) config('services.meilisearch.key'),
        );
    }

    /** @return array<int, array<string, mixed>> */
    private function document(Book $book): array
    {
        return [
            'id' => $book->id,
            'title' => $book->title,
            'author' => $book->author,
            'publisher' => $book->publisher,
            'isbn' => $book->isbn,
            'category' => $book->category,
            'year' => $book->year,
        ];
    }

    public function indexBooks(): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            $documents = Book::query()
                ->get()
                ->map(fn (Book $b) => $this->document($b))
                ->all();

            $this->client()->index(self::INDEX)->addDocuments($documents);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function indexBook(Book $book): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            $this->client()->index(self::INDEX)->addDocuments([$this->document($book)]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function removeBook(Book $book): void
    {
        if (! $this->enabled()) {
            return;
        }

        try {
            $this->client()->index(self::INDEX)->deleteDocument($book->id);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * @return array<int, string>|null id buku terurut relevansi, atau null bila
     *                                 Meili tidak dapat dihubungi (pemanggil fallback ke DB).
     */
    public function searchBooks(?string $q, ?string $category = null): ?array
    {
        if (($q === null || $q === '') && ($category === null || $category === '')) {
            return null;
        }

        if (! $this->enabled()) {
            return null;
        }

        try {
            $options = ['limit' => 200];

            if ($category) {
                $options['filter'] = 'category = '.$this->quote($category);
            }

            $result = $this->client()->index(self::INDEX)->search((string) $q, $options);

            return array_map(static fn (array $hit) => (string) $hit['id'], $result->getHits());
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    private function quote(string $value): string
    {
        return '"'.str_replace('"', '\"', $value).'"';
    }
}
