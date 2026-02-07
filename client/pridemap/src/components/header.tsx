import React from 'react';

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
            <img src="/src/assets/tempLogo.jpg" alt="Temporary Logo" style={{ height: '1rem' }} />
            <h1 style={{ margin: '1em' }}>Welcome to Pride Map</h1>
            <button>Menu</button>
        </header>
    );
};