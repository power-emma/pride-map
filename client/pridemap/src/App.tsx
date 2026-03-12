import { useState, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import MapComponent from './MapComponent';
import Header from './components/Header';
import './App.css'
import CardDeck from './CardDeck';
import CreateLocationPage from './CreateLocationPage.tsx';

function App() {
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const mapRef = useRef<HTMLDivElement>(null);

	const handleLocationSelect = (lat: number, lng: number, name: string) => {
		setSelectedLocation({lat, lng, name});
		// Scroll to map
		mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<>
			<Header />
			<Routes>
				<Route
					path="/"
					element={
						<>
							<div ref={mapRef}>
								<MapComponent selectedLocation={selectedLocation} />
							</div>
							<CardDeck title={'Off-Map Services!'} onLocationSelect={handleLocationSelect} />
							<br />
						</>
					}
				/>
				<Route path="/create-location" element={<CreateLocationPage />} />
			</Routes>
		</>
	)
}

export default App
