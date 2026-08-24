import { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactElement;
    allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-400">Verifying session...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/machines" replace />;
    }

    return children;
};
