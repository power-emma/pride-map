import React, { useEffect, useState } from "react";
import { CircleMarker, Marker, Popup, useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MarkerContainer = () => {
    const map = useMap();

    const pins: { name: string, position: [number, number] }[] = [
        // All of these are just test pins to get the map working
        // These locations are not in the scope of the project, but all are in Ottawa
        { name: "uOttawa Train Station", position: [45.42060673930713, -75.68282689676013] },
        { name: "Parliament Hill", position: [45.423604508836554, -75.7008049778447] },
        { name: "Former Rideau McDonald's", position: [45.42632581387826, -75.69195630717243] },
        { name: "Carleton University", position: [45.38556616302182, -75.69599464626776]}
        
    ];

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