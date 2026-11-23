import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import FactoryDashboard from './components/live_dashboard/FactoryDashboard'
import OperationsDashboard from './components/live_dashboard/operations/OperationsDashboard'
import MachineFleetPage from './components/machine_fleet/explorer/MachineFleetPage'
import MachineDetails from './components/machine_fleet/MachineDetails'
import SimulationPage from './components/simulation/SimulationPage'
import ProductionLines from './components/production_lines/ProductionLines'
import ProductionLinesMockupV2 from './components/production_lines/ProductionLinesMockupV2'
import FactoryProvider from './context/FactoryContext'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AuthPage } from './components/auth/AuthPage'

function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<Routes>
					<Route path="/login" element={<AuthPage />} />
					<Route
						path="/*"
						element={
							<ProtectedRoute>
								<FactoryProvider>
									<AppLayout>
										<Routes>
											<Route path="/" element={<Navigate to="/dashboard" replace />} />
											<Route path="/machines" element={<MachineFleetPage />} />
											<Route path="/machines/:id" element={<MachineDetails />} />
											<Route path="/simulation" element={<SimulationPage />} />
											<Route path="/dashboard" element={<OperationsDashboard />} />
											<Route path="/dashboard/backup" element={<FactoryDashboard />} />
											<Route path="/production" element={<ProductionLines />} />
											<Route path="/production1" element={<ProductionLinesMockupV2 />} />
											<Route path="*" element={<Navigate to="/dashboard" replace />} />
										</Routes>
									</AppLayout>
								</FactoryProvider>
							</ProtectedRoute>
						}
					/>
				</Routes>
			</AuthProvider>
		</BrowserRouter>
	)
}

export default App
