{!! $declaration !!}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>{{ $base }}/</loc>
        <changefreq>daily</changefreq>
    </url>
@foreach ($posts as $post)
    <url>
        <loc>{{ $base }}/berita/{{ $post->slug }}</loc>
        <lastmod>{{ ($post->published_at ?? $post->updated_at)->toAtomString() }}</lastmod>
        <changefreq>weekly</changefreq>
    </url>
@endforeach
</urlset>
