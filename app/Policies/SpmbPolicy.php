<?php

namespace App\Policies;

use App\Models\SpmbApplication;
use App\Models\User;

class SpmbPolicy
{
    public function review(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu', 'operator']);
    }

    public function decide(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'admin_tu']);
    }

    public function viewApplication(User $user, SpmbApplication $application): bool
    {
        return $this->review($user);
    }
}
