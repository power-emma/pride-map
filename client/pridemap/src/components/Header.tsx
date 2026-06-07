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

interface HeaderProps {
    authToken?: string | null;
    onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ authToken, onLogout }) => {
    return (
        <header className="site-header">
            <div className="site-header__pins">
                {PRIDE_COLOURS.map(colour => (
                    <PridePin key={colour} colour={colour} height={60} />
                ))}
            </div>
            <h1 className="site-header__title">Welcome to Pride Map</h1>
            <nav className="site-header__nav">
                <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
                <Link to="/manage-locations" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Manage Locations</Link>
                {authToken && onLogout && (
                    <button
                        onClick={onLogout}
                        style={{
                            background: 'transparent',
                            border: '1px solid #555',
                            borderRadius: 6,
                            color: 'inherit',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: '0.3rem 0.75rem',
                        }}
                    >
                        Sign out
                    </button>
                )}
            </nav>
        </header>
    );
};

export default Header;