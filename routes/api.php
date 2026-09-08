<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\OtpController;
use App\Http\Controllers\Api\V1\StudentController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:60,1');
    Route::post('/password/forgot', fn () => response()->json([
        'data' => ['message' => 'Jika email terdaftar, tautan reset telah dikirim.'],
        'meta' => null, 'errors' => null,
        'request_id' => request()->header('X-Request-ID', (string) str()->ulid()),
    ]))->middleware('throttle:60,1');
    Route::post('/otp/request', [OtpController::class, 'request'])->middleware('throttle:60,1');
    Route::post('/otp/verify', [OtpController::class, 'verify'])->middleware('throttle:60,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/students', [StudentController::class, 'index']);
        Route::post('/students', [StudentController::class, 'store']);
        Route::get('/students/{student}', [StudentController::class, 'show']);
        Route::put('/students/{student}', [StudentController::class, 'update']);
        Route::delete('/students/{student}', [StudentController::class, 'destroy']);
        Route::post('/attendance/scans', [AttendanceController::class, 'scan']);
        Route::get('/attendance/reports', [AttendanceController::class, 'reports']);
    });
});
