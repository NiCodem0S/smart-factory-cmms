import Sidebar from './Sidebar'
import { useState, ReactNode } from 'react'
import { NavigationContext } from '../../context/NavigationContext'

interface AppLayoutProps {
	children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)

	return (
		<div className='flex h-dvh bg-gray-100 overflow-hidden'>
			<Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

			<div className='flex flex-col flex-1 w-full overflow-hidden'>
				<NavigationContext.Provider value={{
					isOpen: isSidebarOpen,
					toggle: () => setIsSidebarOpen(open => !open),
				}}>
					<main className='flex-1 overflow-y-auto'>{children}</main>
				</NavigationContext.Provider>
			</div>
		</div>
	)
}
