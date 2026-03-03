import { Marker, Popup } from "react-leaflet";

const MarkerComponent = ({ name, position }: { name: string, position: [number, number] }) => {

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