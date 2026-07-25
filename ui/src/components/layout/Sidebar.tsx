import { X, Home, Settings, Wrench, BarChart2 } from 'lucide-react'

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    return (
        <>
            {
                isOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                        onClick={() => setIsOpen(false)} />
                )
            }
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-100 flex flex-col
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                md:relative md:translate-x-0
            `}>
                <div className="p-4 h-16 flex justify-between items-center bg-slate-900">
                    <h2 className="text-xl font-bold tracking-tight">Smart Factory</h2>

                    <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 mt-4 px-3 space-y-1">
                    <a href="#" className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md">
                        <Home className="w-5 h-5 mr-3 shrink-0" />
                        <span>Machine Fleet</span>
                    </a>

                    <a href="#" className="flex items-center px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
                        <Wrench className="w-5 h-5 mr-3 shrink-0" />
                        <span>Maintenance</span>
                    </a>

                    <a href="#" className="flex items-center px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
                        <BarChart2 className="w-5 h-5 mr-3 shrink-0" />
                        <span>Analytics</span>
                    </a>
                </nav>

                <div className="p-4 border-t border-slate-800 px-3">
                    <a href="#" className="flex items-center px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
                        <Settings className="w-5 h-5 mr-3 shrink-0" />
                        <span>Settings</span>
                    </a>
                </div>
            </aside>
        </>
    )
}