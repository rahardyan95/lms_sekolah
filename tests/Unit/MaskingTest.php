<?php

namespace Tests\Unit;

use App\Models\BankAccount;
use App\Services\KtsService;
use App\Services\SearchService;
use Tests\TestCase;

/**
 * Logika murni yang menyembunyikan data sensitif / memutuskan fallback.
 * Kesalahan di sini bocor PII atau mematikan pencarian tanpa jejak.
 */
class MaskingTest extends TestCase
{
    public function test_nik_is_never_shown_beyond_last_four_digits(): void
    {
        $service = new KtsService;

        $this->assertSame('****0001', $service->maskNik('3175012345670001'));
        $this->assertSame('****5678', $service->maskNik('3175 0123 4567 5678'));
        $this->assertSame('****1', $service->maskNik('1'));
    }

    public function test_missing_or_non_numeric_nik_masks_completely(): void
    {
        $service = new KtsService;

        $this->assertSame('****', $service->maskNik(null));
        $this->assertSame('****', $service->maskNik(''));
        $this->assertSame('****', $service->maskNik('abcd-efgh'));
    }

    public function test_bank_account_mask_keeps_only_last_four_digits(): void
    {
        $this->assertSame('****3456', BankAccount::mask('1234567890123456'));
        $this->assertSame('****3456', BankAccount::mask('1234-5678-9012-3456'));
        $this->assertSame('****', BankAccount::mask(''));
    }

    public function test_search_returns_null_when_meili_is_disabled(): void
    {
        config(['services.meilisearch.host' => '']);
        $service = new SearchService;

        // Query kosong = tidak ada pencarian → tidak perlu menyentuh Meili.
        $this->assertNull($service->searchBooks(null, null));
        $this->assertNull($service->searchBooks('', ''));

        // Filter kategori saja pun harus jatuh ke DB (host kosong).
        $this->assertNull($service->searchBooks(null, 'Fiksi'));
    }

    public function test_search_returns_null_instead_of_throwing_when_meili_unreachable(): void
    {
        // Port tertutup → koneksi ditolak cepat; service WAJIB mengembalikan
        // null (pemanggil fallback ke DB), bukan melempar ke pengguna.
        config(['services.meilisearch.host' => 'http://127.0.0.1:1']);
        $service = new SearchService;

        $this->assertNull($service->searchBooks('algoritma', null));
    }
}
