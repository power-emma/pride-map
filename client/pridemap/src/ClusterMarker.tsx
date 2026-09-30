import { Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { CATEGORY_COLOURS, DEFAULT_COLOUR } from "./categoryColours";

/**
 * Builds the circular "bubble" icon shown when several pins overlap.
 * The bubble grows a little as the count climbs so dense areas read clearly.
 */
// A cluster mixes at most this many category colours so the bubble stays legible.
const MAX_CLUSTER_COLOURS = 2;

const buildClusterIcon = (count: number, categories: string[]): L.DivIcon => {
    const size = count < 10 ? 36 : count < 100 ? 44 : 52;

    const distinctColours = [...new Set(
        (categories.length > 0 ? categories : [])
            .map(cat => CATEGORY_COLOURS[cat]?.border ?? DEFAULT_COLOUR.border)
    )];
    const colours = distinctColours.length > 0
        ? distinctColours.slice(0, MAX_CLUSTER_COLOURS)
        : [DEFAULT_COLOUR.border];

    const gradient = colours.length === 1
        ? colours[0]
        : `linear-gradient(135deg, ${colours.join(', ')})`;

    const html = `
        <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${gradient};
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: ${count < 100 ? 14 : 12}px;
            font-family: system-ui, sans-serif;
        ">${count}</div>`;

    return L.divIcon({
        html,
        className: 'pin-cluster',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const ClusterMarker = ({ count, position, categories, bounds }: {
    count: number,
    position: [number, number],
    categories: string[],
    bounds: [number, number][],
}) => {
    const map = useMap();

    const handleClick = () => {
        if (bounds.length > 0 && typeof map.flyToBounds === 'function') {
            map.flyToBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 17 });
        }
    };

    return (
        <Marker
            position={position}
            icon={buildClusterIcon(count, categories)}
            eventHandlers={{ click: handleClick }}
        />
    );
};

export default ClusterMarker;
