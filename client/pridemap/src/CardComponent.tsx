import React, { useEffect, useState } from 'react';

const CardComponent = ({ title, description, buttonText }: { title: string, description: string, buttonText: string }) => {


    

    


    return (
        <>
        <div style={{backgroundColor: '#5e5c64', border: '1px solid #c061cb', borderRadius: '8px', overflow: 'hidden', maxWidth: '33vw', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
            <div style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', margin: '0 0 12px 0' }}>{title}</h3>
                <p style={{ fontSize: '16px', color: '#ffffff', opacity: 0.7, margin: '0 0 20px 0', lineHeight: 1.6 }}>{description}</p>
                <a href="#" style={{ display: 'inline-block', backgroundColor: '#c061cb', color: 'white', padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 500, fontSize: '14px', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>{buttonText}</a>
            </div>
      </div>
    </>
    );
};

export default CardComponent;
