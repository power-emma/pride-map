import React, { useEffect, useState } from 'react';
import CardComponent from './CardComponent';

const CardDeck = ({title}: {title: string}) => {

    

    return (
        <div style={{ justifyContent: 'center', alignItems: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffffff', margin: '24px 0px 24px 0px' }}>{title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 24vw))', gap: '1.5vw' }}>
            <CardComponent title={'Emma\'s Garage'} description={'Usually at a friends house with a broken down 1998 Nissan Maxima, Location differs based on how much she has annoyed the last person whose driveway she occupied. Services range from Oil Changes to Clutch Replacements.'} buttonText={'See Current Location'} />
            <CardComponent title={'Lorem Ipsum'} description={'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'} buttonText={'Learn More'} />
            <CardComponent title={'Dolor Sit Amet'} description={'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'} buttonText={'Discover'} />
        </div>
    </div>
    );
};

export default CardDeck;
