import { useEffect, useState } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { useTranslation } from "react-i18next";
import "./i18n";

const UserMarkerComponent = () => {
	const map = useMap();
	const { t } = useTranslation();
	const [userPosition, setUserPosition] = useState<LatLngExpression | null>(null);

	useEffect(() => {
		map.locate({
			enableHighAccuracy: true,
		}).on("locationfound", function (e) {
			setUserPosition([e.latlng.lat, e.latlng.lng]);
		});
	}, [map]);

	if (!userPosition) return null;

	return (
		<CircleMarker
			center={userPosition}
			pathOptions={{
				color: "white",
				fillColor: "#4169E1",
				fillOpacity: 1,
				weight: 2,
			}}
		>
			<Popup>{t('map.youAreHere')}</Popup>
		</CircleMarker>
	);
}

export default UserMarkerComponent;