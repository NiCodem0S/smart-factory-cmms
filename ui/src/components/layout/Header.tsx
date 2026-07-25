import { Menu } from 'lucide-react'

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

			{/* Reszta Headera (np. nazwa otwartej strony, profil użytkownika) */}
			<div className='flex-1 flex justify-between items-center'>
				<h1 className='text-xl font-semibold text-gray-800'>Machine Fleet</h1>

				{/* Miejsce na tymczasowy profil użytkownika */}
				<div className='flex items-center space-x-4'>
					<div className='w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm'>
						JD
					</div>
				</div>
			</div>
		</header>
	)
}
