import type { MouseEvent } from 'react';

const CardComponent = ({ 
    title, 
    description, 
    buttonText, 
    url, 
    latitude, 
    longitude, 
    onLocationSelect 
}: { 
    title: string, 
    description: string, 
    buttonText: string, 
    url?: string | null,
    latitude?: number | null,
    longitude?: number | null,
    onLocationSelect?: (lat: number, lng: number, name: string) => void
}) => {

    const hasLocation = latitude !== null && longitude !== null;

    const handleSeeOnMap = (e: MouseEvent) => {
        e.preventDefault();
        if (hasLocation && latitude && longitude && onLocationSelect) {
            onLocationSelect(latitude, longitude, title);
        }
    };

    return (
        <>
        <div style={{backgroundColor: '#5e5c64', border: '1px solid #c061cb', borderRadius: '8px', overflow: 'hidden', maxWidth: '33vw', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
            <div style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', margin: '0 0 12px 0' }}>{title}</h3>
                <div style={{ 
                    fontSize: '16px', 
                    color: '#ffffff', 
                    opacity: 0.7, 
                    margin: '0 0 20px 0', 
                    lineHeight: 1.6,
                    maxHeight: 'calc(1.6em * 4)',
                    overflowY: 'auto',
                    paddingRight: '8px'
                }}>
                    {description}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {hasLocation && (
                        <a 
                            href="#" 
                            onClick={handleSeeOnMap}
                            style={{ 
                                display: 'inline-block', 
                                backgroundColor: '#62a0ea', 
                                color: 'white', 
                                padding: '10px 24px', 
                                borderRadius: '6px', 
                                textDecoration: 'none', 
                                fontWeight: 500, 
                                fontSize: '14px', 
                                transition: 'opacity 0.2s' 
                            }} 
                            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'} 
                            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            See on Map
                        </a>
                    )}
                    <a 
                        href={url || '#'} 
                        target={url ? '_blank' : undefined} 
                        rel={url ? 'noopener noreferrer' : undefined} 
                        style={{ 
                            display: 'inline-block', 
                            backgroundColor: '#c061cb', 
                            color: 'white', 
                            padding: '10px 24px', 
                            borderRadius: '6px', 
                            textDecoration: 'none', 
                            fontWeight: 500, 
                            fontSize: '14px', 
                            transition: 'opacity 0.2s' 
                        }} 
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'} 
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        {buttonText}
                    </a>
                </div>
            </div>
      </div>
    </>
    );
};

export default CardComponent;
