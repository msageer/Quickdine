import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');

  if (!userStr || !token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    
    // Check if user role is allowed
    if (!allowedRoles.includes(user.role)) {
      // Redirect based on role
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      if (user.role === 'restaurant') return <Navigate to={`/restaurant/${user.restaurant_id}`} replace />;
      if (user.role === 'waiter') return <Navigate to={`/waiter/${user.restaurant_id}`} replace />;
      return <Navigate to="/" replace />;
    }

    return <Outlet />;
  } catch (e) {
    return <Navigate to="/login" replace />;
  }
}
