import React, { useEffect, useState } from "react";
import { CircleMarker, Marker, Popup, useMap } from "react-leaflet";

const UserMarkerComponent = () => {
    const map = useMap();
    const [userPosition, setUserPosition] = useState([0, 0])
    
    //Null useEffect only runs on page load
    useEffect(() => {
        map.locate( {
            enableHighAccuracy: true,
        }).on("locationfound", function (e) {
            setUserPosition([e.latitude, e.longitude]);
        });
    }, []);

  return (
    <div>
      <CircleMarker

        center={userPosition}
        radius={10} // Radius in pixels
        color="white" // Outline color
        fillColor="#4169E1" // Solid fill color
        fillOpacity={1} // Fully solid fill
        weight={2} // Outline weight


      > <Popup>
            You are here!
        </Popup>
    </CircleMarker>
    </div>
  );
}

export default UserMarkerComponent;