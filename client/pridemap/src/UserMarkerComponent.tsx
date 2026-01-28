import React, { useEffect, useState } from "react";
import { CircleMarker, Marker, Popup, useMap } from "react-leaflet";

const UserMarkerComponent = () => {
	const map = useMap();
	const [userPosition, setUserPosition] = useState([0, 0])

	//Null useEffect only runs on page load
	useEffect(() => {
		map.locate({
			enableHighAccuracy: true,
		}).on("locationfound", function (e) {
			setUserPosition([e.latitude, e.longitude]);
		});
	}, []);

	return (
		<div>
			
			<CircleMarker

				center={userPosition}
				radius={10} 
				color="white" 
				fillColor="#4169E1"
				fillOpacity={1} 
				weight={2} 


			> <Popup>
					You are here!
				</Popup>
			</CircleMarker>
		</div>
	);
}

export default UserMarkerComponent;