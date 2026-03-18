import { useState, useRef } from 'react'
import MapComponent from './MapComponent';
import Header from './components/Header';
import CategoryFilter from './components/CategoryFilter';
import './App.css'
import CardDeck from './CardDeck';

function App() {
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const mapRef = useRef<HTMLDivElement>(null);

	const handleLocationSelect = (lat: number, lng: number, name: string) => {
		setSelectedLocation({lat, lng, name});
		// Scroll to map
		mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<>
			<Header></Header>
			<div ref={mapRef}>
				<MapComponent selectedLocation={selectedLocation} categoryFilter={categoryFilter} />
			</div>
			<div className="card-section">
				<CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
				<CardDeck title={'Off-Map Services!'} onLocationSelect={handleLocationSelect} categoryFilter={categoryFilter} />
			</div>
		</>
	)
}

export default App
