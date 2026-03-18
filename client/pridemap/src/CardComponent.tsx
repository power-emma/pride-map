import { useState } from 'react';
import type { MouseEvent } from 'react';
import { CATEGORY_COLOURS, DEFAULT_COLOUR } from './categoryColours';

const CardComponent = ({ 
    title, 
    description, 
    buttonText, 
    url, 
    latitude, 
    longitude, 
    categories = [],
    onLocationSelect 
}: { 
    title: string, 
    description: string, 
    buttonText: string, 
    url?: string | null,
    latitude?: number | null,
    longitude?: number | null,
    categories?: string[],
    onLocationSelect?: (lat: number, lng: number, name: string) => void
}) => {
    const [open, setOpen] = useState(false);

    const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

    const handleSeeOnMap = (e: MouseEvent) => {
        e.preventDefault();
        if (hasLocation && latitude && longitude && onLocationSelect) {
            onLocationSelect(latitude, longitude, title);
        }
    };

    return (
        <div style={{
            borderBottom: '1px solid #3d3846',
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
            {/* Row / header */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 4px',
                    textAlign: 'left',
                    gap: '8px',
                }}
            >
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>{title}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, marginLeft: '8px' }}>
                    {categories.map(cat => {
                        const colour = CATEGORY_COLOURS[cat] ?? DEFAULT_COLOUR;
                        return (
                            <span key={cat} style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#ffffff',
                                backgroundColor: colour.bg,
                                border: `1px solid ${colour.border}`,
                                borderRadius: '999px',
                                padding: '2px 8px',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.02em',
                            }}>
                                {cat}
                            </span>
                        );
                    })}
                </span>
                <span style={{
                    fontSize: '18px',
                    color: '#c061cb',
                    flexShrink: 0,
                    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    lineHeight: 1,
                }}>▾</span>
            </button>

            {/* Accordion body */}
            {open && (
                <div style={{ padding: '0 4px 12px 4px' }}>
                    <p style={{
                        fontSize: '14px',
                        color: '#ffffff',
                        opacity: 0.75,
                        margin: '0 0 12px 0',
                        lineHeight: 1.6,
                    }}>
                        {description}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {hasLocation && (
                            <a
                                href="#"
                                onClick={handleSeeOnMap}
                                style={{
                                    display: 'inline-block',
                                    backgroundColor: '#62a0ea',
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    transition: 'opacity 0.2s',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                See on Map
                            </a>
                        )}
                        {url && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    backgroundColor: '#c061cb',
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    transition: 'opacity 0.2s',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                {buttonText}
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardComponent;
