import { useState, useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import MapComponent from './MapComponent';
import Header from './components/Header';
import './App.css'
import CardDeck from './CardDeck';

function App() {
	const [count, setCount] = useState(0)
	const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, name: string} | null>(null);
	const mapRef = useRef<HTMLDivElement>(null);

	const handleLocationSelect = (lat: number, lng: number, name: string) => {
		setSelectedLocation({lat, lng, name});
		// Scroll to map
		mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<>
			<Header></Header>
			<h1>PrideMap!</h1>
			<div ref={mapRef}>
				<MapComponent selectedLocation={selectedLocation} />
			</div>
			<CardDeck title={'Off-Map Services!'} onLocationSelect={handleLocationSelect} /> 
			<br />
			<button onClick={() => setCount((count) => count + 1)}>
				Sample Button has been clicked {count} times
			</button>

			<p className="read-the-docs">
				Website is under construction!
			</p>
		</>
	)
}

export default App
