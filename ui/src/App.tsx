import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LiveDashboard from './components/live_dashboard/LiveDashboard'
import MachineFleet from './components/machine_fleet/MachineFleet'
import MachineDetails from './components/machine_fleet/MachineDetails'

function App() {
	return (
		<BrowserRouter>
			<AppLayout>
				<Routes>
					<Route path="/" element={<Navigate to="/machines" replace />} />
					<Route path="/machines" element={<MachineFleet />} />
					<Route path="/machines/:id" element={<MachineDetails />} />
					<Route path="/dashboard" element={<LiveDashboard />} />
				</Routes>
			</AppLayout>
		</BrowserRouter>
	)
}

export default App
