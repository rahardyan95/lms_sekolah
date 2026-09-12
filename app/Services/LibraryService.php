<?php

namespace App\Services;

use App\Models\Book;
use App\Models\BookLoan;
use App\Models\Student;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Perpustakaan: pinjam/kembali transaksional, stok tak pernah negatif. */
class LibraryService
{
    public function borrow(Book $book, Student $student, int $days = 14): BookLoan
    {
        return DB::transaction(function () use ($book, $student, $days) {
            $book = Book::whereKey($book->id)->lockForUpdate()->firstOrFail();

            if ($book->availableStock() <= 0) {
                throw new HttpException(422, 'Stok buku habis.');
            }

            $active = BookLoan::where('book_id', $book->id)
                ->where('student_id', $student->id)
                ->where('status', 'borrowed')
                ->exists();

            if ($active) {
                throw new HttpException(409, 'Buku ini masih dipinjam oleh siswa tersebut.');
            }

            return BookLoan::create([
                'book_id' => $book->id,
                'student_id' => $student->id,
                'borrowed_at' => now(),
                'due_at' => now()->addDays($days),
                'status' => 'borrowed',
            ]);
        });
    }

    public function giveBack(BookLoan $loan): BookLoan
    {
        if ($loan->status !== 'borrowed') {
            throw new HttpException(422, 'Peminjaman sudah dikembalikan.');
        }

        $loan->update(['returned_at' => now(), 'status' => 'returned']);

        return $loan->refresh();
    }
}
