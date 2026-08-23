import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LiveDashboard from './components/live_dashboard/LiveDashboard'
import MachineFleet from './components/machine_fleet/MachineFleet'
import MachineDetails from './components/machine_fleet/MachineDetails'
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
					{/* Public Authentication Route */}
					<Route path="/login" element={<AuthPage />} />

					{/* Protected CMMS Workspace Routes */}
					<Route
						path="/*"
						element={
							<ProtectedRoute>
								<FactoryProvider>
									<AppLayout>
										<Routes>
											<Route path="/" element={<Navigate to="/machines" replace />} />
											<Route path="/machines" element={<MachineFleet />} />
											<Route path="/machines/:id" element={<MachineDetails />} />
											<Route path="/dashboard" element={<LiveDashboard />} />
											<Route path="/production" element={<ProductionLines />} />
											<Route path="/production1" element={<ProductionLinesMockupV2 />} />
											<Route path="*" element={<Navigate to="/machines" replace />} />
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
