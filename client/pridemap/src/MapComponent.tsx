import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
    const defaultCenter: LatLngExpression = [45.42060673930713, -75.68282689676013]; // uOttawa

    

    

    


    return (
        <>  
            {/* OSM doesnt give a dark mode for free, but with some CSS trickery we can make it work */}
            <style>{` 
                .leaflet-tile {
                    filter: brightness(0.6) invert(1) contrast(2) hue-rotate(180deg) saturate(0.5) brightness(0.7);
                }
            `}</style>

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
        </>
    );
};

export default MapComponent;