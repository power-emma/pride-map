import React, { use, useEffect, useState } from "react";
import { CircleMarker, Marker, Popup, useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MarkerContainer = () => {
    const map = useMap();

    const [pins, setPins] = useState<{ name: string, position: [number, number] }[]>([]);

    useEffect(() => {
        fetch('http://localhost:3001/pins/all')
        .then(response => response.json())
        .then(json => {
            setPins(json)
                console.log(json);
        })
        .catch(error => console.error(error));
    }, []);




    const dataToMarkers = pins.map((pin, index) => (
        <MarkerComponent key={index} name={pin.name} position={pin.position} />
    ));


    return (
        <div>


            {dataToMarkers}

            <UserMarkerComponent />

        </div>  
    );
}

export default MarkerContainer;