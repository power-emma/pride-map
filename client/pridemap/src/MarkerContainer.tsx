import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

import UserMarkerComponent from './UserMarkerComponent';
import MarkerComponent from './MarkerComponent';
import ClusterMarker from './ClusterMarker';

type Pin = { name: string, position: [number, number], categories: string[], description?: string | null, address?: string | null, url?: string | null };

// Grid cell size in screen pixels. Pins in the same cell are always grouped.
const CLUSTER_RADIUS_PX = 45;

// A group of this many pins or fewer is never drawn as a cluster bubble — its
// members are rendered as individual markers instead. Only groups larger than
// this collapse into a single cluster marker.
const UNCLUSTER_MAX = 3;

// The most a single cluster may span on screen, in pixels. Chaining stops at
// this cap, so a cluster can never swallow a wide dense area — its *geographic*
// size therefore scales with zoom on its own: continent-sized blobs at world
// zoom split into country- and then city-sized clusters as you zoom in, with no
// place hardcoded.
const CLUSTER_MAX_EXTENT_PX = CLUSTER_RADIUS_PX * 4;

type ClusterEntry =
    | { type: 'single', pin: Pin }
    | { type: 'cluster', count: number, position: [number, number], categories: string[], bounds: [number, number][] };

// Groups pins that overlap on screen at the current zoom level.
//
// Clustering is O(n): pins are projected to pixel space and bucketed into a grid
// whose cell size is CLUSTER_RADIUS_PX. Rather than doing pairwise distance
// checks (which degrade to O(n²) when many pins pack into one cell at low zoom),
// every pin in a cell is unioned to that cell's leader in O(1), and clusters
// then chain across *adjacent occupied cells* — but only while the cluster's
// on-screen bounding box stays within CLUSTER_MAX_EXTENT_PX. That cap keeps a
// dense region from collapsing into one giant point. Only pins inside (or just
// outside) the viewport are considered, so the rendered marker count stays
// bounded regardless of dataset size.
const clusterPins = (pins: Pin[], map: ReturnType<typeof useMap>): ClusterEntry[] => {
    // Guard for environments (e.g. tests) where the map lacks projection maths.
    if (typeof map.project !== 'function' || typeof map.getZoom !== 'function') {
        return pins.map(pin => ({ type: 'single' as const, pin }));
    }

    const zoom = map.getZoom();

    // Cull to the visible area (padded by one screen) when the map exposes
    // bounds, so off-screen pins don't spawn markers Leaflet would just hide.
    let inView: (pin: Pin) => boolean = () => true;
    if (typeof map.getBounds === 'function') {
        const bounds = map.getBounds().pad(1);
        inView = (pin) => bounds.contains(pin.position);
    }

    // Project the visible pins and index them into the grid, recording each
    // cell's leader (the first pin seen in it).
    const pts: { pin: Pin, cx: number, cy: number, x: number, y: number }[] = [];
    const cellLeader = new Map<string, number>();
    for (const pin of pins) {
        if (!inView(pin)) continue;
        const p = map.project(pin.position, zoom);
        const cx = Math.floor(p.x / CLUSTER_RADIUS_PX);
        const cy = Math.floor(p.y / CLUSTER_RADIUS_PX);
        const idx = pts.length;
        pts.push({ pin, cx, cy, x: p.x, y: p.y });
        const key = `${cx}:${cy}`;
        if (!cellLeader.has(key)) cellLeader.set(key, idx);
    }

    // Union-find over the projected points, tracking each component's pixel
    // bounding box (stored at the root) so we can reject merges that would grow
    // a cluster past the extent cap.
    const parent = pts.map((_, i) => i);
    const minX = pts.map(p => p.x), maxX = pts.map(p => p.x);
    const minY = pts.map(p => p.y), maxY = pts.map(p => p.y);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]]; // path halving
            i = parent[i];
        }
        return i;
    };
    // Merge unconditionally (used within a cell, which is always within the cap).
    const union = (a: number, b: number) => {
        const ra = find(a), rb = find(b);
        if (ra === rb) return;
        parent[ra] = rb;
        if (minX[ra] < minX[rb]) minX[rb] = minX[ra];
        if (maxX[ra] > maxX[rb]) maxX[rb] = maxX[ra];
        if (minY[ra] < minY[rb]) minY[rb] = minY[ra];
        if (maxY[ra] > maxY[rb]) maxY[rb] = maxY[ra];
    };
    // Merge only if the combined bounding box stays within the extent cap.
    const unionIfWithinExtent = (a: number, b: number) => {
        const ra = find(a), rb = find(b);
        if (ra === rb) return;
        const w = Math.max(maxX[ra], maxX[rb]) - Math.min(minX[ra], minX[rb]);
        const h = Math.max(maxY[ra], maxY[rb]) - Math.min(minY[ra], minY[rb]);
        if (w > CLUSTER_MAX_EXTENT_PX || h > CLUSTER_MAX_EXTENT_PX) return;
        parent[ra] = rb;
        minX[rb] = Math.min(minX[ra], minX[rb]);
        maxX[rb] = Math.max(maxX[ra], maxX[rb]);
        minY[rb] = Math.min(minY[ra], minY[rb]);
        maxY[rb] = Math.max(maxY[ra], maxY[rb]);
    };

    // 1) Union every pin to its cell's leader — O(1) per pin, no pairwise checks.
    for (let i = 0; i < pts.length; i++) {
        union(i, cellLeader.get(`${pts[i].cx}:${pts[i].cy}`)!);
    }

    // 2) Chain across adjacent occupied cells, capped by extent. Only the four
    // "forward" neighbours are checked so each adjacency is handled once.
    const neighbours = [[1, 0], [1, 1], [0, 1], [-1, 1]];
    for (const [key, leader] of cellLeader) {
        const [cx, cy] = key.split(':').map(Number);
        for (const [dx, dy] of neighbours) {
            const other = cellLeader.get(`${cx + dx}:${cy + dy}`);
            if (other !== undefined) unionIfWithinExtent(leader, other);
        }
    }

    // Aggregate each component: count, centroid, bounding box and category set.
    // Bounds are kept as running min/max corners rather than a per-member array,
    // so a giant low-zoom cluster costs O(1) memory instead of O(members).
    // `members` holds the actual pins, but only while a group is still small
    // enough to possibly stay unclustered — it is capped at UNCLUSTER_MAX, so a
    // giant low-zoom cluster still costs O(1) memory. Once a group exceeds the
    // cap we stop collecting members and rely on the running aggregates instead.
    type Agg = {
        count: number,
        sumLat: number, sumLng: number,
        minLat: number, maxLat: number, minLng: number, maxLng: number,
        categories: Set<string>,
        members: Pin[],
    };
    const groups = new Map<number, Agg>();
    for (let i = 0; i < pts.length; i++) {
        const pin = pts[i].pin;
        const [lat, lng] = pin.position;
        const root = find(i);
        let g = groups.get(root);
        if (!g) {
            g = { count: 0, sumLat: 0, sumLng: 0, minLat: lat, maxLat: lat, minLng: lng, maxLng: lng, categories: new Set(), members: [] };
            groups.set(root, g);
        }
        g.count++;
        if (g.members.length < UNCLUSTER_MAX) g.members.push(pin);
        g.sumLat += lat; g.sumLng += lng;
        if (lat < g.minLat) g.minLat = lat;
        if (lat > g.maxLat) g.maxLat = lat;
        if (lng < g.minLng) g.minLng = lng;
        if (lng > g.maxLng) g.maxLng = lng;
        for (const c of pin.categories) g.categories.add(c);
    }

    const result: ClusterEntry[] = [];
    for (const g of groups.values()) {
        if (g.count <= UNCLUSTER_MAX) {
            // Small group: render each member on its own rather than clustering.
            for (const pin of g.members) result.push({ type: 'single', pin });
        } else {
            result.push({
                type: 'cluster',
                count: g.count,
                position: [g.sumLat / g.count, g.sumLng / g.count],
                categories: [...g.categories],
                bounds: [[g.minLat, g.minLng], [g.maxLat, g.maxLng]],
            });
        }
    }

    return result;
};

const MarkerContainer = ({ selectedLocation: _selectedLocation, categoryFilter, searchQuery = '', onMarkerSelect }: {
    selectedLocation?: {lat: number, lng: number, name: string},
    categoryFilter: string | null,
    searchQuery?: string,
    onMarkerSelect?: (lat: number, lng: number, name: string, details?: { categories?: string[], description?: string | null, address?: string | null, url?: string | null }) => void,
}) => {
    const map = useMap();
    const [pins, setPins] = useState<Pin[]>([]);
    // Bumped on every zoom/move so clusters recompute against the current view.
    const [, setViewVersion] = useState(0);

    useEffect(() => {
        fetch('/api/pins/all')
        .then(response => response.json())
        .then(json => {
            setPins(json);
        })
        .catch(error => console.error(error));
    }, []);

    useEffect(() => {
        if (typeof map.on !== 'function' || typeof map.off !== 'function') return;
        // Debounce so a burst of move/zoom events triggers a single recompute
        // once the view settles, rather than re-clustering on every frame.
        let timer: ReturnType<typeof setTimeout>;
        const rerender = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setViewVersion(v => v + 1), 120);
        };
        map.on('zoomend', rerender);
        map.on('moveend', rerender);
        return () => {
            clearTimeout(timer);
            map.off('zoomend', rerender);
            map.off('moveend', rerender);
        };
    }, [map]);

    const query = searchQuery.trim().toLowerCase();
    const visiblePins = pins.filter(pin => {
        const matchesCategory = !categoryFilter || pin.categories.includes(categoryFilter);
        const matchesQuery = !query || pin.name.toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
    });

    const clusters = clusterPins(visiblePins, map);

    const markers = clusters.map((entry) => {
        if (entry.type === 'single') {
            const pin = entry.pin;
            return (
                <MarkerComponent
                    key={`s:${pin.position[0]},${pin.position[1]}:${pin.name}`}
                    name={pin.name}
                    position={pin.position}
                    categories={pin.categories}
                    description={pin.description}
                    address={pin.address}
                    url={pin.url}
                    onMarkerSelect={onMarkerSelect}
                />
            );
        }

        // Bubble anchored at the centroid of its members.
        const [lat, lng] = entry.position;
        return (
            <ClusterMarker
                key={`c:${lat.toFixed(5)},${lng.toFixed(5)}:${entry.count}`}
                count={entry.count}
                position={entry.position}
                categories={entry.categories}
                bounds={entry.bounds}
            />
        );
    });

    return (
        <>
            {markers}
            <UserMarkerComponent />
        </>
    );
}

export default MarkerContainer;
