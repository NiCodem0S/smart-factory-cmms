import { Menu, Plus } from 'lucide-react'

interface HeaderProps {
	onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
	return (
		<header className='bg-white border-b border-gray-200 h-16 flex items-center px-4 md:px-6 relative z-10 shrink-0'>
			{/* Przycisk Hamburger Menu (tylko telefony) */}
			<button
				onClick={onMenuClick}
				className='mr-4 md:hidden text-gray-500 hover:text-gray-900 focus:outline-none'
				aria-label='Open menu'>
				<Menu className='w-6 h-6' />
			</button>

			{/* Reszta Headera (nazwa otwartej strony, przycisk akcji) */}
			<div className='flex-1 flex justify-between items-center'>
				<div>
					<h1 className='text-xl font-bold text-slate-800'>Machine Fleet</h1>
					<p className='text-xs text-slate-500 hidden sm:block'>Manage units, status, and work order allocations</p>
				</div>

				{/* Przycisk dodawania nowej maszyny */}
				<button className='bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center'>
					<Plus className='w-4 h-4 mr-2' />
					<span>Add New Machine</span>
				</button>
			</div>
		</header>
	)
}
