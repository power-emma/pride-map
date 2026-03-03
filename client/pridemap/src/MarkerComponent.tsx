import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import rainbowPin from "./assets/rainbow-pin.svg";

const rainbowIcon = L.icon({
    iconUrl: rainbowPin,
    iconSize: [25, 41],
    iconAnchor: [12, 41],   // tip of the pin
    popupAnchor: [1, -34],  // popup opens above the pin
});

const MarkerComponent = ({ name, position }: { name: string, position: [number, number] }) => {
    return (
        <Marker position={position} icon={rainbowIcon}>
            <Popup>{name}</Popup>
        </Marker>
    );
}

export default MarkerComponent;
