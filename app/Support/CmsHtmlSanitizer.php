<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Sanitasi HTML CMS berbasis allowlist DOM, bukan `strip_tags`.
 *
 * `strip_tags` hanya membuang TAG, bukan ATRIBUT — sehingga `onerror`,
 * `style="…url(javascript:…)"`, dan yang paling berbahaya `href` dengan
 * skema ber-entity (`jav&#97;script:`) lolos utuh dan menjadi stored XSS
 * begitu artikel dirender. Karena itu nilai atribut di sini divalidasi
 * SETELAH DOM mendekode entity, dan hanya atribut di daftar putih yang
 * dipertahankan (atribut `on*`/`style` otomatis hilang).
 */
final class CmsHtmlSanitizer
{
    /** @var array<int, string> */
    private const ALLOWED_TAGS = [
        'p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a', 'img',
    ];

    /** @var array<string, array<int, string>> */
    private const ALLOWED_ATTRIBUTES = [
        'a' => ['href', 'title'],
        'img' => ['src', 'alt', 'title'],
    ];

    /** @var array<int, string> */
    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

    private const VOID_TAGS = ['br', 'img'];

    /** Tag yang isinya dibuang bersama tag-nya (bukan sekadar di-unwrap). */
    private const DROPPED_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math'];

    public static function clean(?string $html): ?string
    {
        if ($html === null) {
            return null;
        }

        if (! class_exists(DOMDocument::class)) {
            return self::cleanWithoutDom($html);
        }

        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);

        // Wrapper: libxml butuh satu elemen akar; isinya yang kita serialisasi.
        $document->loadHTML(
            '<?xml encoding="UTF-8"><div id="cms-root">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->getElementsByTagName('div')->item(0);

        if (! $root instanceof DOMElement) {
            return self::cleanWithoutDom($html);
        }

        return trim(self::serializeChildren($root));
    }

    private static function serializeChildren(DOMNode $node): string
    {
        $output = '';

        foreach ($node->childNodes as $child) {
            $output .= self::serializeNode($child);
        }

        return $output;
    }

    private static function serializeNode(DOMNode $node): string
    {
        if ($node->nodeType === XML_TEXT_NODE) {
            return htmlspecialchars((string) $node->nodeValue, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }

        // Komentar, PI, dan doctype dibuang.
        if ($node->nodeType !== XML_ELEMENT_NODE) {
            return '';
        }

        /** @var DOMElement $node */
        $tag = strtolower($node->nodeName);

        // Skrip/gaya/plugin: isinya tidak dipublikasikan sama sekali.
        if (in_array($tag, self::DROPPED_WITH_CONTENT, true)) {
            return '';
        }

        $inner = self::serializeChildren($node);

        if (! in_array($tag, self::ALLOWED_TAGS, true)) {
            // Tag tak diizinkan dibuang, teks isinya tetap dipertahankan.
            return $inner;
        }

        $attributes = '';

        foreach (self::ALLOWED_ATTRIBUTES[$tag] ?? [] as $name) {
            if (! $node->hasAttribute($name)) {
                continue;
            }

            $value = trim($node->getAttribute($name));

            if ($value === '') {
                continue;
            }

            if (($name === 'href' || $name === 'src') && ! self::isSafeUrl($value)) {
                continue;
            }

            $attributes .= ' '.$name.'="'.htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'"';
        }

        if (in_array($tag, self::VOID_TAGS, true)) {
            return '<'.$tag.$attributes.'>';
        }

        return '<'.$tag.$attributes.'>'.$inner.'</'.$tag.'>';
    }

    /**
     * Skema dinilai SETELAH entity didekode DOM dan karakter kontrol/spasi
     * dibuang, sehingga `jav&#97;script:`, `java\tscript:` dan `JaVaScRiPt:`
     * semuanya tertolak. URL tanpa skema (relatif/anchor) diizinkan.
     */
    private static function isSafeUrl(string $url): bool
    {
        $normalized = strtolower((string) preg_replace('/[\x00-\x20\x7f]+/', '', $url));

        // Protocol-relative (`//evil.com`) & varian backslash tidak punya skema
        // di string, tetapi browser memakai skema halaman — tolak eksplisit
        // sebelum dianggap URL relatif yang aman.
        if (str_starts_with($normalized, '//') || str_starts_with($normalized, '\\\\')) {
            return false;
        }

        if (preg_match('#^[a-z][a-z0-9+.\-]*:#', $normalized) !== 1) {
            return true;
        }

        return preg_match('#^(https?|mailto|tel):#', $normalized) === 1;
    }

    /** Fallback bila ekstensi DOM tidak tersedia (lebih longgar, tetap aman dari skrip). */
    private static function cleanWithoutDom(string $html): string
    {
        $clean = strip_tags($html, '<p><br><strong><em><b><i><ul><ol><li><h2><h3><blockquote><a><img>');
        $clean = (string) preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $clean);
        $clean = (string) preg_replace('/\s(href|src|style)\s*=\s*("|\')\s*javascript:[^"\']*("|\')/i', '', $clean);

        return trim($clean);
    }
}
