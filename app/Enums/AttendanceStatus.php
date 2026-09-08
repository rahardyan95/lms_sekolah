<?php

namespace App\Enums;

enum AttendanceStatus: string
{
    case Hadir = 'hadir';
    case Terlambat = 'terlambat';
    case Sakit = 'sakit';
    case Izin = 'izin';
    case Alpa = 'alpa';
}
