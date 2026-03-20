import React from 'react';
import { Link } from 'react-router-dom';

const PIN_PATH = "M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0z";

const PRIDE_COLOURS = ['#FF0018', '#FFA52C', '#FFFF41', '#008018', '#0000F9', '#86007D'];

const PridePin: React.FC<{ colour: string; height?: number }> = ({ colour, height = 40 }) => {
    const w = height * (25 / 41);
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 25 41"
            width={w}
            height={height}
            style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))', overflow: 'visible' }}
        >
            <path d={PIN_PATH} fill={colour} />
            <path d={PIN_PATH} fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="12.5" cy="12.5" r="4" fill="white" />
        </svg>
    );
};

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '6px 4px 6px 4px' }}>
                {PRIDE_COLOURS.map(colour => (
                    <PridePin key={colour} colour={colour} height={60} />
                ))}
            </div>
            <h1>Welcome to Pride Map</h1>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
                    <Link to="/manage-locations" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Manage Locations</Link>
                </nav>
            </div>
        </header>
    );
};

export default Header;