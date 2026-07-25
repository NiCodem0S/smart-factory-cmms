import Sidebar from './Sidebar'
import Header from './Header'
import { useState, ReactNode, use } from 'react'

interface AppLayoutProps {
	children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)

	return (
		<div className='flex h-screen bg-gray-100 overflow-hidden'>
			{<Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />}

			<div className='flex flex-col flex-1 w-full overflow-hidden'>
				{<Header onMenuClick={() => setIsSidebarOpen(true)} />}
				<main className='flex-1 overflow-y-auto p-4 md:p-6'>{children}</main>
			</div>
		</div>
	)
}
