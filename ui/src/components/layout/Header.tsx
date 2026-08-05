import { ReactNode } from "react";
import { Menu } from "lucide-react";

interface HeaderProps {
    onMenuClick?: () => void;
    leftContent?: ReactNode;
    rightContent?: ReactNode;
    children?: ReactNode;
}

export default function Header({ onMenuClick, leftContent, rightContent, children }: HeaderProps) {
    return (
        <header className="h-16 bg-white shadow-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
            <div className="flex items-center gap-3">
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-lg border border-slate-200 focus:outline-none"
                        aria-label="Toggle Navigation"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                {leftContent || children}
            </div>

            {rightContent && (
                <div className="flex items-center gap-3">
                    {rightContent}
                </div>
            )}
        </header>
    );
}
