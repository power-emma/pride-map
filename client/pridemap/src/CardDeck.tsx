import { useEffect, useState } from 'react';
import './i18n';
import CardComponent from './CardComponent';
import { useTranslation } from 'react-i18next';

interface Card {
    name: string;
    name_fr?: string | null;
    description: string;
    description_fr?: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    url: string | null;
    image_url: string | null;
    categories: string[];
}

const CardDeck = ({title, onLocationSelect, categoryFilter, searchQuery = ''}: {
    title: string,
    onLocationSelect?: (lat: number, lng: number, name: string, details?: { nameFr?: string | null; description?: string | null; descriptionFr?: string | null; address?: string | null; url?: string | null; imageUrl?: string | null; categories?: string[] }) => void,
    categoryFilter?: string | null,
    searchQuery?: string,
}) => {
    const { t, i18n } = useTranslation();
    const [cards, setCards] = useState<Card[]>([]);

    useEffect(() => {
        fetch('/api/cards')
            .then(response => response.json())
            .then(json => {
                setCards(json);
                console.log('Loaded cards:', json);
            })
            .catch(error => console.error('Error loading cards:', error));
    }, []);

    const query = searchQuery.trim().toLowerCase();
    const visibleCards = cards.filter(card => {
        const matchesCategory = !categoryFilter || card.categories.includes(categoryFilter);
        const matchesQuery = !query || card.name.toLowerCase().includes(query) || (card.name_fr ?? '').toLowerCase().includes(query);
        return matchesCategory && matchesQuery;
    });

    return (
        <div style={{ justifyContent: 'center', alignItems: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffffff', margin: '24px 0px 24px 0px' }}>{title}</h2>
            <div className="card-grid">
                {visibleCards.map((card, index) => {
                    const isFrench = i18n.language.startsWith('fr');
                    return (
                        <CardComponent
                            key={index}
                            title={isFrench ? card.name_fr || card.name : card.name}
                            nameEnglish={card.name}
                            nameFrench={card.name_fr}
                            description={card.description}
                            descriptionFrench={card.description_fr}
                            buttonText={card.url ? t('cards.visitWebsite') : t('cards.learnMore')}
                            url={card.url}
                            imageUrl={card.image_url}
                            latitude={card.latitude}
                            longitude={card.longitude}
                            categories={card.categories}
                            onLocationSelect={onLocationSelect}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default CardDeck;
