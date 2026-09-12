<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\Student;
use App\Models\User;

class FinancePolicy
{
    public function manage(User $user): bool
    {
        return $user->hasAnyRole(['super_admin', 'bendahara']);
    }

    public function viewStudentInvoices(User $user, Student $student): bool
    {
        if ($this->manage($user)) {
            return true;
        }

        if ($user->student?->id === $student->id) {
            return true;
        }

        return GuardianPolicy::isGuardianOf($user, $student->id);
    }

    public function viewInvoice(User $user, Invoice $invoice): bool
    {
        return $this->viewStudentInvoices($user, $invoice->student);
    }
}
