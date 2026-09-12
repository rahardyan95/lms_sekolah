<?php

namespace App\Observers;

use App\Models\Book;
use App\Services\SearchService;

/**
 * Menjaga indeks Meilisearch sinkron dengan perubahan buku.
 * Kegagalan Meili ditelan di SearchService agar CRUD buku tetap berhasil.
 */
class BookObserver
{
    public function __construct(private SearchService $search) {}

    public function saved(Book $book): void
    {
        $this->search->indexBook($book);
    }

    public function deleted(Book $book): void
    {
        $this->search->removeBook($book);
    }
}
