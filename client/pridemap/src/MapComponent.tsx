import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Make sure the CSS is imported
import { useEffect } from 'react';

import MarkerContainer from './MarkerContainer';

// Component to handle map updates
const MapUpdater = ({ selectedLocation }: { selectedLocation: {lat: number, lng: number, name: string} | null }) => {
    const map = useMap();

    useEffect(() => {
        if (selectedLocation) {
            map.flyTo([selectedLocation.lat, selectedLocation.lng], 16, {
                duration: 1.5
            });
        }
    }, [selectedLocation, map]);

    return null;
};

const MapComponent = ({ selectedLocation }: { selectedLocation?: {lat: number, lng: number, name: string} | null }) => {
    const defaultCenter = [45.42060673930713, -75.68282689676013]; // uOttawa Train Station

    

    

    


    return (
        <MapContainer center={defaultCenter} zoom={14} scrollWheelZoom={true} style={{ height: '70vh', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Leaflet Maps Pin format */}
            <MarkerContainer selectedLocation={selectedLocation || undefined}> 
                
            </MarkerContainer>
            
            <MapUpdater selectedLocation={selectedLocation || null} />
        </MapContainer>
    );
};

export default MapComponent;