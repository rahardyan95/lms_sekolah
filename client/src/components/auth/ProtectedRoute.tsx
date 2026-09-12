import React from 'react';

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * OOP route guard: dashboard & semua menu non-publik wajib login.
 * CMS publik (`public`) tidak lewat komponen ini — tetap terbuka.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ isAuthenticated, fallback, children }) => {
  if (!isAuthenticated) return <>{fallback}</>;
  return <>{children}</>;
};
