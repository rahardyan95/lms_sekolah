<?php

namespace Tests\Unit;

use App\Support\CmsHtmlSanitizer;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CmsHtmlSanitizerTest extends TestCase
{
    public function test_strips_script_tag_and_event_handlers(): void
    {
        $dirty = '<p onclick="evil()">Halo <script>alert(1)</script>'
            .'<img src=x onerror="steal()"> <a href="javascript:bad()">klik</a></p>';

        $clean = (string) CmsHtmlSanitizer::clean($dirty);

        $this->assertStringNotContainsString('<script', $clean);
        $this->assertStringNotContainsString('onclick', $clean);
        $this->assertStringNotContainsString('onerror', $clean);
        $this->assertStringNotContainsString('javascript:', $clean);
        $this->assertStringContainsString('<p>', $clean);
    }

    public function test_keeps_basic_formatting_tags(): void
    {
        $clean = CmsHtmlSanitizer::clean('<h2>Judul</h2><ul><li>a</li></ul><strong>tebal</strong>');

        $this->assertSame('<h2>Judul</h2><ul><li>a</li></ul><strong>tebal</strong>', $clean);
    }

    public function test_null_passthrough(): void
    {
        $this->assertNull(CmsHtmlSanitizer::clean(null));
    }

    /**
     * Vektor bypass nyata (ditemukan lewat uji penetrasi): `strip_tags`
     * hanya membuang tag, sehingga atribut ber-skema ber-entity lolos utuh.
     */
    #[DataProvider('dangerousPayloads')]
    public function test_dangerous_payloads_are_neutralized(string $dirty, string $forbidden): void
    {
        $clean = (string) CmsHtmlSanitizer::clean($dirty);

        $this->assertStringNotContainsString($forbidden, $clean, "payload lolos: {$dirty}");
    }

    /** @return array<string, array{0: string, 1: string}> */
    public static function dangerousPayloads(): array
    {
        return [
            'entity-encoded skema' => ['<a href="jav&#97;script:alert(1)">x</a>', 'javascript:'],
            'desimal entity' => ['<a href="&#106;&#97;vascript:alert(1)">x</a>', 'vascript:'],
            'campuran huruf besar' => ['<a href="JaVaScRiPt:alert(1)">x</a>', 'avascript'],
            'tab di dalam skema' => ["<a href=\"java\tscript:alert(1)\">x</a>", 'avascript'],
            'data uri' => ['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', 'data:'],
            'css url skema' => ['<p style="background:url(javascript:alert(1))">s</p>', 'style'],
            'svg onload' => ['<svg onload="alert(1)"></svg>', 'onload'],
            'img onerror' => ['<img src=x onerror="alert(1)">', 'onerror'],
            'iframe' => ['<iframe src="https://evil.test"></iframe>', 'iframe'],
            'protocol-relative' => ['<a href="//evil.test/phishing">x</a>', 'evil.test'],
            'protocol-relative backslash' => ['<a href="\\\\evil.test/phishing">x</a>', 'evil.test'],
        ];
    }

    public function test_allowed_links_and_images_survive_with_safe_urls_only(): void
    {
        $clean = (string) CmsHtmlSanitizer::clean(
            '<a href="/berita/juara" title="Berita">rel</a> '
            .'<a href="https://sekolah.sch.id">ext</a> '
            .'<a href="mailto:info@sekolah.sch.id">mail</a> '
            .'<img src="/img/banner.png" alt="Banner">'
        );

        $this->assertStringContainsString('href="/berita/juara"', $clean);
        $this->assertStringContainsString('title="Berita"', $clean);
        $this->assertStringContainsString('href="https://sekolah.sch.id"', $clean);
        $this->assertStringContainsString('href="mailto:info@sekolah.sch.id"', $clean);
        $this->assertStringContainsString('src="/img/banner.png"', $clean);
        $this->assertStringContainsString('alt="Banner"', $clean);
    }

    public function test_script_content_is_not_published_as_text(): void
    {
        $clean = (string) CmsHtmlSanitizer::clean('<p>Sebelum</p><script>var secret = "kunci";</script><p>Sesudah</p>');

        $this->assertStringNotContainsString('kunci', $clean);
        $this->assertStringContainsString('<p>Sebelum</p>', $clean);
        $this->assertStringContainsString('<p>Sesudah</p>', $clean);
    }
}
