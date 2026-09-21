import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MarkerContainer = ({ selectedLocation: _selectedLocation, categoryFilter, searchQuery = '', onMarkerSelect }: {
    selectedLocation?: {lat: number, lng: number, name: string},
    categoryFilter: string | null,
    searchQuery?: string,
    onMarkerSelect?: (lat: number, lng: number, name: string, details?: { categories?: string[], description?: string | null, address?: string | null, url?: string | null }) => void,
}) => {
    const map = useMap();
    void map;
    const [pins, setPins] = useState<{ name: string, position: [number, number], categories: string[], description?: string | null, address?: string | null, url?: string | null }[]>([]);

    useEffect(() => {
        fetch('/api/pins/all')
        .then(response => response.json())
        .then(json => {
            setPins(json);
        })
        .catch(error => console.error(error));
    }, []);

    const query = searchQuery.trim().toLowerCase();
    const visiblePins = pins.filter(pin => {
        const matchesCategory = !categoryFilter || pin.categories.includes(categoryFilter);
        const matchesQuery = !query || pin.name.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
    });

    const dataToMarkers = visiblePins.map((pin, index) => {
        return (
            <MarkerComponent 
                key={index} 
                name={pin.name} 
                position={pin.position}
                categories={pin.categories}
                description={pin.description}
                address={pin.address}
                url={pin.url}
                onMarkerSelect={onMarkerSelect}
            />
        );
    });

    return (
        <>
            {dataToMarkers}
            <UserMarkerComponent />
        </>
    );
}

export default MarkerContainer;