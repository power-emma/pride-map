import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Make sure the CSS is imported
import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';

const MapComponent = () => {
    const defaultCenter = [45.42060673930713, -75.68282689676013]; // uOttawa Train Station

    

    

    


    return (
        <MapContainer center={defaultCenter} zoom={14} scrollWheelZoom={true} style={{ height: '70vh', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Leaflet Maps Pin format */}
            <MarkerComponent name="uOttawa Train Station" position={defaultCenter} />

            <UserMarkerComponent />

        </MapContainer>
    );
};

export default MapComponent;