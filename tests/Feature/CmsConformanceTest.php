<?php

namespace Tests\Feature;

use App\Enums\RoleEnum;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CmsConformanceTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(string $role): User
    {
        Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        $user = User::factory()->create(['status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_stored_content_is_sanitized_and_workflow_statuses_accepted(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);

        $post = $this->actingAs($admin)->postJson('/api/v1/cms/posts', [
            'title' => 'Berita Uji',
            'content' => '<p>Halo</p><script>alert(1)</script><img src=x onerror="bad()">',
            'status' => 'review',
        ])->assertCreated()->json('data');

        $this->assertStringNotContainsString('<script', $post['content']);
        $this->assertStringNotContainsString('onerror', $post['content']);
        $this->assertSame('review', $post['status']);

        // Non-published tidak tampil di endpoint publik.
        $this->getJson('/api/v1/cms/posts')->assertOk()->assertJsonCount(0, 'data.data');

        $this->actingAs($admin)->putJson("/api/v1/cms/posts/{$post['id']}", [
            'status' => 'published',
        ])->assertOk()->assertJsonPath('data.status', 'published');

        $this->assertNotNull(Post::findOrFail($post['id'])->published_at);

        // archived juga valid.
        $this->actingAs($admin)->putJson("/api/v1/cms/posts/{$post['id']}", [
            'status' => 'archived',
        ])->assertOk()->assertJsonPath('data.status', 'archived');
    }

    public function test_sitemap_and_robots_are_public_and_list_only_published_slugs(): void
    {
        $admin = $this->userWithRole(RoleEnum::SuperAdmin->value);

        $published = $this->actingAs($admin)->postJson('/api/v1/cms/posts', [
            'title' => 'Juara LKS', 'content' => '<p>Isi</p>', 'status' => 'published',
        ])->assertCreated()->json('data');

        $draft = $this->actingAs($admin)->postJson('/api/v1/cms/posts', [
            'title' => 'Draf Internal', 'content' => '<p>Isi</p>', 'status' => 'draft',
        ])->assertCreated()->json('data');

        $sitemap = $this->get('/sitemap.xml')->assertOk();
        $this->assertStringContainsString('application/xml', (string) $sitemap->headers->get('content-type'));
        $this->assertStringContainsString($published['slug'], (string) $sitemap->getContent());
        $this->assertStringNotContainsString($draft['slug'], (string) $sitemap->getContent());

        $robots = $this->get('/robots.txt')->assertOk();
        $this->assertStringContainsString('Sitemap:', (string) $robots->getContent());
    }
}
