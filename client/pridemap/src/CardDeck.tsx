import React, { useEffect, useState } from 'react';
import CardComponent from './CardComponent';

interface Card {
    name: string;
    description: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    url: string | null;
}

const CardDeck = ({title, onLocationSelect}: {title: string, onLocationSelect?: (lat: number, lng: number, name: string) => void}) => {
    const [cards, setCards] = useState<Card[]>([]);

    useEffect(() => {
        fetch('http://localhost:3001/cards')
            .then(response => response.json())
            .then(json => {
                setCards(json);
                console.log('Loaded cards:', json);
            })
            .catch(error => console.error('Error loading cards:', error));
    }, []);

    return (
        <div style={{ justifyContent: 'center', alignItems: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffffff', margin: '24px 0px 24px 0px' }}>{title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 24vw))', gap: '1.5vw' }}>
                {cards.map((card, index) => (
                    <CardComponent 
                        key={index}
                        title={card.name} 
                        description={card.description || 'No description available'} 
                        buttonText={card.url ? 'Visit Website' : 'Learn More'}
                        url={card.url}
                        latitude={card.latitude}
                        longitude={card.longitude}
                        onLocationSelect={onLocationSelect}
                    />
                ))}
            </div>
        </div>
    );
};

export default CardDeck;
