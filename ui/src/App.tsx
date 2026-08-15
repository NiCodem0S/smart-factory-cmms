import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LiveDashboard from './components/live_dashboard/LiveDashboard'
import MachineFleet from './components/machine_fleet/MachineFleet'
import MachineDetails from './components/machine_fleet/MachineDetails'
import ProductionLinesMockupV2 from './components/production_lines/ProductionLinesMockupV2'
import FactoryProvider from './context/FactoryContext'

function App() {
	return (
		<BrowserRouter>
			<FactoryProvider>
				<AppLayout>
					<Routes>
						<Route path="/" element={<Navigate to="/machines" replace />} />
						<Route path="/machines" element={<MachineFleet />} />
						<Route path="/machines/:id" element={<MachineDetails />} />
						<Route path="/dashboard" element={<LiveDashboard />} />
						<Route path="/production" element={<ProductionLinesMockupV2 />} />
					</Routes>
				</AppLayout>
			</FactoryProvider>
		</BrowserRouter>
	)
}

export default App
