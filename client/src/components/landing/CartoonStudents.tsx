import React from 'react';

export const CartoonStudents: React.FC = () => (
  <svg
    className="cartoon-students"
    viewBox="0 0 420 260"
    role="img"
    aria-label="Ilustrasi tiga murid sedang belajar bersama"
  >
    <defs>
      <linearGradient id="student-paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff8e8" />
        <stop offset="1" stopColor="#f7dca4" />
      </linearGradient>
    </defs>

    <ellipse cx="218" cy="239" rx="164" ry="13" fill="#0f766e" opacity="0.12" />

    <g className="cartoon-student cartoon-student-back" transform="translate(254 22)">
      <path d="M34 73c4-27 24-42 49-42 27 0 43 18 47 45l-5 23H38Z" fill="#f2bf8a" />
      <path d="M39 62c9-28 36-43 63-30 10 5 17 12 22 22l-14 11-9-12-16 12-11-10-20 14Z" fill="#26364a" />
      <circle cx="68" cy="84" r="5" fill="#26364a" />
      <circle cx="100" cy="84" r="5" fill="#26364a" />
      <path d="M70 105c10 8 19 8 29 0" fill="none" stroke="#9a513f" strokeWidth="4" strokeLinecap="round" />
      <path d="M43 124c8-17 23-25 42-25s36 8 47 25l19 66H23Z" fill="#f59e0b" />
      <path d="m70 128 17 20 17-20" fill="none" stroke="#fff7ed" strokeWidth="8" />
      <path d="M68 191h54l10 38H61Z" fill="#374151" />
    </g>

    <g className="cartoon-student cartoon-student-center" transform="translate(128 12)">
      <path d="M32 80c3-32 25-51 55-51 32 0 52 20 54 53l-9 34H40Z" fill="#f1b982" />
      <path d="M34 72c3-30 31-50 61-43 21 5 37 21 44 44l-16 7-12-18-18 13-16-14-20 16Z" fill="#1f2937" />
      <circle cx="71" cy="91" r="5" fill="#26364a" />
      <circle cx="105" cy="91" r="5" fill="#26364a" />
      <path d="M73 111c10 7 20 7 30-1" fill="none" stroke="#9a513f" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 135c7-22 24-33 50-33 25 0 44 11 54 33l19 77H16Z" fill="#0f766e" />
      <path d="M64 138h48" stroke="#fef3c7" strokeWidth="7" strokeLinecap="round" />
      <path d="M70 150h36" stroke="#fef3c7" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      <path d="M64 210h58l8 26H57Z" fill="#1f2937" />
      <path d="M18 157 0 198" stroke="#f1b982" strokeWidth="15" strokeLinecap="round" />
      <path d="M138 157 161 190" stroke="#f1b982" strokeWidth="15" strokeLinecap="round" />
    </g>

    <g className="cartoon-student cartoon-student-front" transform="translate(12 70)">
      <path d="M31 65c5-25 24-39 47-39 26 0 43 18 45 43l-8 29H38Z" fill="#b96e49" />
      <path d="M30 64c4-29 25-46 52-46 25 0 42 13 51 38l-13 13-13-15-17 12-15-13-24 17Z" fill="#713f2d" />
      <circle cx="57" cy="77" r="5" fill="#26364a" />
      <circle cx="88" cy="77" r="5" fill="#26364a" />
      <path d="M59 96c9 6 17 6 26 0" fill="none" stroke="#7d3d2e" strokeWidth="4" strokeLinecap="round" />
      <path d="M23 119c10-19 27-28 49-28 25 0 42 9 51 28l16 79H4Z" fill="#ef4444" />
      <path d="M36 127c12 8 27 11 43 11 15 0 28-3 39-11" fill="none" stroke="#fee2e2" strokeWidth="6" />
      <path d="M49 197h51l8 29H40Z" fill="#334155" />
      <path d="M24 140 0 177" stroke="#b96e49" strokeWidth="14" strokeLinecap="round" />
      <path d="M115 143 143 168" stroke="#b96e49" strokeWidth="14" strokeLinecap="round" />
    </g>

    <g className="cartoon-paper" transform="translate(250 184) rotate(-7)">
      <rect width="124" height="59" rx="8" fill="url(#student-paper)" stroke="#e7c889" strokeWidth="3" />
      <path d="M18 18h78M18 29h62M18 40h73" stroke="#d49d4c" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <path d="m102 20 7 7 12-15" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);
