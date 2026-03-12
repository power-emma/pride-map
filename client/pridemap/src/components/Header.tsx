import React from 'react';
import { Link } from 'react-router-dom';
import rainbowPin from '../assets/rainbow-pin.svg';

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
            <img src={rainbowPin} alt="Pride Map Logo" style={{ height: '3em' }} />
            <h1 style={{  }}>Welcome to Pride Map</h1>
            <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
                <Link to="/create-location" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>Add Location</Link>
            </nav>
        </header>
    );
};

export default Header;