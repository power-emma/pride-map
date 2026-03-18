import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { CATEGORY_COLOURS, DEFAULT_COLOUR } from "./categoryColours";

// Pin path drawn at its natural 25×41 size, offset by 4px padding on each side
// so the SVG canvas is 33×49 and the drop shadow has room to render unclipped.
const PAD = 4;
const PIN_PATH = `M${12.5+PAD} ${PAD}C${5.596+PAD} ${PAD} ${PAD} ${5.596+PAD} ${PAD} ${12.5+PAD}c0 9.375 ${12.5} 28.5 ${12.5} 28.5S${25+PAD} ${21.875+PAD} ${25+PAD} ${12.5+PAD}C${25+PAD} ${5.596+PAD} ${19.404+PAD} ${PAD} ${12.5+PAD} ${PAD}z`;
const W = 25 + PAD * 2; // 33
const H = 41 + PAD * 2; // 49
const CX = 12.5 + PAD;
const CY = 12.5 + PAD;

/**
 * Encodes the SVG as a data URI so that url(#id) paint-server references
 * resolve within the SVG's own document — bypassing the Leaflet divIcon
 * page-URL resolution bug entirely.
 */
const buildPinIcon = (categories: string[]): L.Icon => {
    const colours = categories.length > 0
        ? categories.map(cat => CATEGORY_COLOURS[cat]?.border ?? DEFAULT_COLOUR.border)
        : [DEFAULT_COLOUR.border];

    const gradientId = 'g';

    let stops: string;
    if (colours.length === 1) {
        stops = `<stop offset="0%" stop-color="${colours[0]}"/>`;
    } else {
        stops = colours.map((colour, i) => {
            const pct = Math.round((i / (colours.length - 1)) * 100);
            return `<stop offset="${pct}%" stop-color="${colour}"/>`;
        }).join('');
    }

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
        `<defs>`,
        `<filter id="s" x="-20%" y="-20%" width="140%" height="140%">`,
        `<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>`,
        `</filter>`,
        `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
        stops,
        `</linearGradient>`,
        `</defs>`,
        `<path d="${PIN_PATH}" fill="url(#${gradientId})" filter="url(#s)"/>`,
        `<path d="${PIN_PATH}" fill="none" stroke="white" stroke-width="1.5"/>`,
        `<circle cx="${CX}" cy="${CY}" r="4" fill="white"/>`,
        `</svg>`,
    ].join('');

    const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;

    return L.icon({
        iconUrl: dataUri,
        iconSize: [W, H],
        iconAnchor: [CX, H],
        popupAnchor: [1, -H + PAD],
    });
};

const MarkerComponent = ({ name, position, categories = [] }: {
    name: string,
    position: [number, number],
    categories?: string[]
}) => {
    const icon = buildPinIcon(categories);
    return (
        <Marker position={position} icon={icon}>
            <Popup>{name}</Popup>
        </Marker>
    );
}

export default MarkerComponent;
