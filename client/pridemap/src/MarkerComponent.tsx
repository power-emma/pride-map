import React, { useEffect, useState } from "react";
import { CircleMarker, Marker, Popup, useMap } from "react-leaflet";

const MarkerComponent = ({ name, position }: { name: string, position: [number, number] }) => {
    const map = useMap();


    return (
        <div>
            <Marker position={position}>
                <Popup>
                    {name}
                </Popup>
            </Marker>
        </div>
    );
}

export default MarkerComponent;