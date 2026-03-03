import React from 'react';
import rainbowPin from '../assets/rainbow-pin.svg';

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
            <img src={rainbowPin} alt="Pride Map Logo" style={{ height: '3em' }} />
            <h1 style={{ margin: '1em' }}>Welcome to Pride Map</h1>
            <button>Menu</button>
        </header>
    );
};

export default Header;