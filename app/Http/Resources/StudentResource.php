<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nisn' => $this->nisn,
            'name' => $this->name,
            'gender' => $this->gender,
            'class' => $this->whenLoaded('classRoom', fn () => $this->classRoom?->name),
            'status' => $this->status,
        ];
    }
}
