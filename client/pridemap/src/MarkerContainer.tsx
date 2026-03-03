import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MarkerContainer = ({ selectedLocation: _selectedLocation }: { selectedLocation?: {lat: number, lng: number, name: string} }) => {
    const map = useMap();
    void map;
    const [pins, setPins] = useState<{ name: string, position: [number, number] }[]>([]);

    useEffect(() => {
        fetch('/api/pins/all')
        .then(response => response.json())
        .then(json => {
            setPins(json);
        })
        .catch(error => console.error(error));
    }, []);

    const dataToMarkers = pins.map((pin, index) => {
        return (
            <MarkerComponent 
                key={index} 
                name={pin.name} 
                position={pin.position}
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