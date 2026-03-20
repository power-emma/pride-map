import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MarkerContainer = ({ selectedLocation: _selectedLocation, categoryFilter }: {
    selectedLocation?: {lat: number, lng: number, name: string},
    categoryFilter: string | null,
}) => {
    const map = useMap();
    void map;
    const [pins, setPins] = useState<{ name: string, position: [number, number], categories: string[] }[]>([]);

    useEffect(() => {
        fetch('/api/pins/all')
        .then(response => response.json())
        .then(json => {
            setPins(json);
        })
        .catch(error => console.error(error));
    }, []);

    const visiblePins = categoryFilter
        ? pins.filter(pin => pin.categories.includes(categoryFilter))
        : pins;

    const dataToMarkers = visiblePins.map((pin, index) => {
        return (
            <MarkerComponent 
                key={index} 
                name={pin.name} 
                position={pin.position}
                categories={pin.categories}
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