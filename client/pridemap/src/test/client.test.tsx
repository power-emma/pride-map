import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Leaflet / react-leaflet mocks ───────────────────────────────────────────
// Leaflet needs a browser canvas that jsdom doesn't provide, so we mock the
// whole library before importing any component that touches it.
vi.mock('leaflet', () => ({
    default: {
        icon: vi.fn(() => ({})),
        map: vi.fn(),
    },
    icon: vi.fn(() => ({})),
}));

vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
    Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
    CircleMarker: ({ children }: { children: React.ReactNode }) => <div data-testid="circle-marker">{children}</div>,
    useMap: vi.fn(() => ({
        flyTo: vi.fn(),
        locate: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
    })),
}));

// Mock SVG asset imports — rainbow-pin.svg no longer used but keep for safety
vi.mock('../assets/rainbow-pin.svg', () => ({ default: 'rainbow-pin.svg' }));

// ─── Leaflet CSS mock ─────────────────────────────────────────────────────────
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ─── Component imports (after mocks) ─────────────────────────────────────────
import Header from '../components/Header';
import CardComponent from '../CardComponent';
import CardDeck from '../CardDeck';
import MarkerComponent from '../MarkerComponent';
import App from '../App';

// ─── Header ──────────────────────────────────────────────────────────────────
describe('Header', () => {
    it('renders the app title', () => {
        render(<Header />);
        expect(screen.getByText('Welcome to Pride Map')).toBeInTheDocument();
    });

    it('renders 6 pride-flag pin SVGs in the logo', () => {
        const { container } = render(<Header />);
        // The logo group contains one <svg> per pride colour
        const svgs = container.querySelectorAll('header svg');
        expect(svgs.length).toBe(6);
    });

    it('renders the Menu button', () => {
        render(<Header />);
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });
});

// ─── CardComponent ────────────────────────────────────────────────────────────
describe('CardComponent', () => {
    it('renders the title and description', async () => {
        const user = userEvent.setup();
        render(
            <CardComponent
                title="Test Organisation"
                description="A great organisation."
                buttonText="Visit Website"
            />
        );
        expect(screen.getByText('Test Organisation')).toBeInTheDocument();
        // description is in the accordion body — open the card first
        await user.click(screen.getByRole('button', { name: /test organisation/i }));
        expect(screen.getByText('A great organisation.')).toBeInTheDocument();
    });

    it('renders the action button with the given text', async () => {
        const user = userEvent.setup();
        render(
            <CardComponent
                title="Test"
                description="Desc"
                buttonText="Visit Website"
                url="https://example.com"
            />
        );
        await user.click(screen.getByRole('button', { name: /test/i }));
        expect(screen.getByRole('link', { name: 'Visit Website' })).toBeInTheDocument();
    });

    it('opens url in a new tab when a url is provided', async () => {
        const user = userEvent.setup();
        render(
            <CardComponent
                title="Test"
                description="Desc"
                buttonText="Visit Website"
                url="https://example.com"
            />
        );
        await user.click(screen.getByRole('button', { name: /test/i }));
        const link = screen.getByRole('link', { name: 'Visit Website' });
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders a "See on Map" button when coordinates are provided', async () => {
        const user = userEvent.setup();
        render(
            <CardComponent
                title="Test"
                description="Desc"
                buttonText="Visit Website"
                latitude={45.4}
                longitude={-75.7}
            />
        );
        await user.click(screen.getByRole('button', { name: /test/i }));
        expect(screen.getByRole('link', { name: /see on map/i })).toBeInTheDocument();
    });

    it('does not render "See on Map" when coordinates are null', async () => {
        const user = userEvent.setup();
        render(
            <CardComponent
                title="Test"
                description="Desc"
                buttonText="Visit Website"
                latitude={null}
                longitude={null}
            />
        );
        await user.click(screen.getByRole('button', { name: /test/i }));
        expect(screen.queryByRole('link', { name: /see on map/i })).not.toBeInTheDocument();
    });

    it('calls onLocationSelect with correct args when "See on Map" is clicked', async () => {
        const user = userEvent.setup();
        const onLocationSelect = vi.fn();
        render(
            <CardComponent
                title="Test Location"
                description="Desc"
                buttonText="Visit Website"
                latitude={45.4}
                longitude={-75.7}
                onLocationSelect={onLocationSelect}
            />
        );
        await user.click(screen.getByRole('button', { name: /test location/i }));
        await user.click(screen.getByRole('link', { name: /see on map/i }));
        expect(onLocationSelect).toHaveBeenCalledOnce();
        expect(onLocationSelect).toHaveBeenCalledWith(45.4, -75.7, 'Test Location');
    });
});

// ─── CardDeck ─────────────────────────────────────────────────────────────────
const mockCards = [
    { name: 'AIDS Committee of Ottawa', description: 'Supports those affected by HIV/AIDS.', address: '19 Main St', latitude: 45.41, longitude: -75.68, url: 'https://www.aco-cso.ca/', categories: ['Community Organisations', 'Healthcare Resources'] },
    { name: 'Bruce House',              description: 'Housing support.',                      address: null,          latitude: null,  longitude: null,   url: null,                            categories: ['Housing and Shelter'] },
];

describe('CardDeck', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockCards),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches cards from /api/cards on mount', async () => {
        render(<CardDeck title="Services" />);
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/cards'));
    });

    it('renders a card for each fetched item', async () => {
        render(<CardDeck title="Services" />);
        await waitFor(() => {
            expect(screen.getByText('AIDS Committee of Ottawa')).toBeInTheDocument();
            expect(screen.getByText('Bruce House')).toBeInTheDocument();
        });
    });

    it('renders the deck title', async () => {
        render(<CardDeck title="Off-Map Services!" />);
        expect(screen.getByText('Off-Map Services!')).toBeInTheDocument();
    });

    it('shows fallback text when a card has no description', async () => {
        const user = userEvent.setup();
        const noDescCards = [{ name: 'Empty', description: null, address: null, latitude: null, longitude: null, url: null, categories: [] }];
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ json: () => Promise.resolve(noDescCards) });
        render(<CardDeck title="Services" />);
        // wait for card to appear, then open accordion to reveal body
        await waitFor(() => expect(screen.getByText('Empty')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /empty/i }));
        expect(screen.getByText('No description available')).toBeInTheDocument();
    });

    it('shows all cards when categoryFilter is null', async () => {
        render(<CardDeck title="Services" categoryFilter={null} />);
        await waitFor(() => {
            expect(screen.getByText('AIDS Committee of Ottawa')).toBeInTheDocument();
            expect(screen.getByText('Bruce House')).toBeInTheDocument();
        });
    });

    it('shows only cards matching the active categoryFilter', async () => {
        render(<CardDeck title="Services" categoryFilter="Housing and Shelter" />);
        await waitFor(() => {
            expect(screen.queryByText('AIDS Committee of Ottawa')).not.toBeInTheDocument();
            expect(screen.getByText('Bruce House')).toBeInTheDocument();
        });
    });

    it('shows no cards when categoryFilter matches nothing', async () => {
        render(<CardDeck title="Services" categoryFilter="Student Resources" />);
        await waitFor(() => {
            expect(screen.queryByText('AIDS Committee of Ottawa')).not.toBeInTheDocument();
            expect(screen.queryByText('Bruce House')).not.toBeInTheDocument();
        });
    });

    it('renders category tags on each card', async () => {
        render(<CardDeck title="Services" />);
        await waitFor(() => {
            expect(screen.getByText('Community Organisations')).toBeInTheDocument();
            expect(screen.getByText('Housing and Shelter')).toBeInTheDocument();
        });
    });
});

// ─── MarkerComponent ─────────────────────────────────────────────────────────
describe('MarkerComponent', () => {
    it('renders a marker with the location name in its popup', () => {
        render(<MarkerComponent name="Capital Pride" position={[45.42, -75.68]} />);
        expect(screen.getByTestId('marker')).toBeInTheDocument();
        expect(screen.getByText('Capital Pride')).toBeInTheDocument();
    });
});

// ─── App (smoke test) ────────────────────────────────────────────────────────
describe('App', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockCards),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders the Header', async () => {
        render(<App />);
        expect(screen.getByText('Welcome to Pride Map')).toBeInTheDocument();
    });

    it('renders the map container', async () => {
        render(<App />);
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('renders the off-map services section title', async () => {
        render(<App />);
        expect(screen.getByText('Off-Map Services!')).toBeInTheDocument();
    });
});
