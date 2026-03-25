import { useState, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MapComponent from './MapComponent';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
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
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [authToken, setAuthToken] = useState<string | null>(getStoredToken);
	const mapRef = useRef<HTMLDivElement>(null);

	const handleLocationSelect = (lat: number, lng: number, name: string) => {
		setSelectedLocation({lat, lng, name});
		// Scroll to map
		mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
			<Header authToken={authToken} onLogout={handleLogout} />
			<Routes>
				<Route
					path="/"
					element={
						<>
							<div ref={mapRef}>
								<MapComponent selectedLocation={selectedLocation} categoryFilter={categoryFilter} />
							</div>
							<CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
							<CardDeck title={'Off-Map Services!'} onLocationSelect={handleLocationSelect} categoryFilter={categoryFilter} />
							<br />
						</>
					}
				/>
				<Route path="/create-location" element={<CreateLocationPage />} />
				<Route
					path="/manage-locations"
					element={
						authToken
							? <ManageLocationsPage authToken={authToken} onAuthError={handleLogout} />
							: <LoginPage onLogin={handleLogin} />
					}
				/>
				<Route path="/login" element={authToken ? <Navigate to="/manage-locations" replace /> : <LoginPage onLogin={handleLogin} />} />
			</Routes>
		</>
	)
}

export default App
