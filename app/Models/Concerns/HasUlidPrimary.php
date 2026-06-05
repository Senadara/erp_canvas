<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

trait HasUlidPrimary
{
    public function initializeHasUlidPrimary(): void
    {
        $this->incrementing = false;
        $this->keyType = 'string';
    }

    protected static function bootHasUlidPrimary(): void
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::ulid();
            }
        });
    }
}
