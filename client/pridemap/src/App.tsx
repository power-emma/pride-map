import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MapComponent from './MapComponent';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import LocationSidebar, { type LocationSidebarItem } from './components/LocationSidebar';
import './App.css'
import CardDeck from './CardDeck';
import CreateLocationPage from './CreateLocationPage.tsx';
import ManageLocationsPage from './ManageLocationsPage.tsx';
import LoginPage from './LoginPage.tsx';

const TOKEN_KEY = 'pride_map_token';

function getStoredToken(): string | null {
	return sessionStorage.getItem(TOKEN_KEY);
}

function App() {
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const [selectedDetails, setSelectedDetails] = useState<LocationSidebarItem | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [authToken, setAuthToken] = useState<string | null>(getStoredToken);
	const [servicesOpen, setServicesOpen] = useState(false);

	const handleLocationSelect = (lat: number, lng: number, name: string, details?: Partial<LocationSidebarItem>) => {
		setSelectedLocation({lat, lng, name});
		setSelectedDetails({
			name,
			categories: details?.categories ?? [],
			description: details?.description ?? null,
			address: details?.address ?? null,
			url: details?.url ?? null,
		});
		setServicesOpen(false);
	};

	function handleLogin(token: string) {
		sessionStorage.setItem(TOKEN_KEY, token);
		setAuthToken(token);
	}

	function handleLogout() {
		sessionStorage.removeItem(TOKEN_KEY);
		setAuthToken(null);
	}

	return (
		<>
			<Routes>
				<Route
					path="/"
					element={
						<div className="map-page">
							<Header authToken={authToken} onLogout={handleLogout}>
								<SearchBar
									query={searchQuery}
									onQueryChange={setSearchQuery}
									selectedCategory={categoryFilter}
									onCategoryChange={setCategoryFilter}
								/>
							</Header>
							<div className="map-fullscreen">
								<MapComponent
									selectedLocation={selectedLocation}
									categoryFilter={categoryFilter}
									searchQuery={searchQuery}
									onMarkerSelect={handleLocationSelect}
								/>
							</div>

							{!selectedDetails && (
								<button
									type="button"
									className="see-all-btn"
									onClick={() => setServicesOpen(open => !open)}
									aria-expanded={servicesOpen}
								>
									<span className="see-all-btn__icon" aria-hidden="true">☰</span>
									See all
								</button>
							)}

							<LocationSidebar location={selectedDetails} onClose={() => setSelectedDetails(null)} />

							{servicesOpen && (
								<div className="services-scrim" onClick={() => setServicesOpen(false)} aria-hidden="true" />
							)}

							<aside
								className={`services-drawer ${servicesOpen ? 'services-drawer--open' : ''}`}
								aria-label="Off-map services"
								aria-hidden={!servicesOpen}
							>
								<button
									type="button"
									className="services-drawer__close"
									aria-label="Close off-map services"
									onClick={() => setServicesOpen(false)}
								>
									×
								</button>
								<div className="services-drawer__body">
									<CardDeck title={'Off-Map Services!'} onLocationSelect={handleLocationSelect} categoryFilter={categoryFilter} searchQuery={searchQuery} />
								</div>
							</aside>
						</div>
					}
				/>
				<Route
					path="/create-location"
					element={
						<>
							<Header authToken={authToken} onLogout={handleLogout} />
							<CreateLocationPage />
						</>
					}
				/>
				<Route
					path="/manage-locations"
					element={
						<>
							<Header authToken={authToken} onLogout={handleLogout} />
							{authToken
								? <ManageLocationsPage authToken={authToken} onAuthError={handleLogout} />
								: <LoginPage onLogin={handleLogin} />}
						</>
					}
				/>
				<Route
					path="/login"
					element={
						authToken
							? <Navigate to="/manage-locations" replace />
							: <><Header authToken={authToken} onLogout={handleLogout} /><LoginPage onLogin={handleLogin} /></>
					}
				/>
			</Routes>
		</>
	)
}

export default App
