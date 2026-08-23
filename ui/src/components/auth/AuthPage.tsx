import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    Lock, 
    Mail, 
    Eye, 
    EyeOff, 
    ArrowRight, 
    AlertCircle, 
    Loader2,
    KeyRound
} from 'lucide-react';

export const AuthPage: React.FC = () => {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/machines';

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // UI state
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);

        try {
            await login({ email, password });
            navigate(from, { replace: true });
        } catch (err: any) {
            const serverMsg = err.response?.data?.message || err.message || 'Authentication failed. Please check your credentials.';
            setErrorMessage(serverMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Quick Login presets for demo testing
    const fillDemoAccount = (demoEmail: string) => {
        setEmail(demoEmail);
        setPassword('TestPassword123!');
        setErrorMessage(null);
    };

    return (
        <div className="min-h-screen w-full bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md space-y-6">
                
                {/* Brand Logo & Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center gap-2.5 mb-1">
                        <img src="/logo.png" alt="Smart Factory Logo" className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold text-slate-900 tracking-wider">
                            Smart<span className="text-blue-600">Factory</span>
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        Intelligent Industrial Telemetry & Maintenance Platform
                    </p>
                </div>

                {/* Main Auth Card (Clean White) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                    
                    <div className="border-b border-slate-100 pb-4">
                        <h2 className="text-base font-bold text-slate-900">Sign In to CMMS</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Enter your workstation credentials below</p>
                    </div>

                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1 font-medium">{errorMessage}</div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    placeholder="name@smartfactory.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Sign In to Dashboard</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                    </form>

                </div>

                {/* Quick Demo Login Chips */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2.5 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                            Quick Demo Credentials
                        </span>
                        <span className="text-slate-400 font-mono">Password: TestPassword123!</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => fillDemoAccount('admin@smartfactory.com')}
                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-purple-300 rounded-lg text-left transition-all"
                        >
                            <div className="font-bold text-slate-800 truncate">SuperAdmin</div>
                            <div className="text-[10px] text-slate-500 truncate">Global (All Halls)</div>
                        </button>

                        <button
                            type="button"
                            onClick={() => fillDemoAccount('kierownik.hala1@smartfactory.com')}
                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all"
                        >
                            <div className="font-bold text-slate-800 truncate">Hall 1 Admin</div>
                            <div className="text-[10px] text-slate-500 truncate">Marek (Hala A)</div>
                        </button>

                        <button
                            type="button"
                            onClick={() => fillDemoAccount('technician@smartfactory.com')}
                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all"
                        >
                            <div className="font-bold text-slate-800 truncate">Technician</div>
                            <div className="text-[10px] text-slate-500 truncate">Anna (Hala A)</div>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
