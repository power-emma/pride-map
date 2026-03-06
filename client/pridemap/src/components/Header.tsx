import React from 'react';
import rainbowPin from '../assets/rainbow-pin.svg';

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
            <img src={rainbowPin} alt="Pride Map Logo" style={{ height: '3em' }} />
            <h1 style={{  }}>Welcome to Pride Map</h1>
            <button>Menu</button>
        </header>
    );
};

export default Header;