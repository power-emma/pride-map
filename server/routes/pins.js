const express = require('express');
const router = express.Router();


const pins =  [
        // All of these are just test pins to get the map working
        // These locations are not in the scope of the project, but all are in Ottawa
        { name: "Parliament Hill", position: [45.423604508836554, -75.7008049778447] },
        { name: "Former Rideau McDonald's", position: [45.42632581387826, -75.69195630717243] },
        { name: "City Hall", position: [45.420790042656215, -75.69005797525594]},

        // Well you have to get places dont you? Train stations are probably a good test
        // (i also had this data already from something else)
        // Line 1 (Confederation Line) - West to East
        { name: "Tunney's Pasture Station", position: [45.403665807946545, -75.73519892457423] },
        { name: "Pimisi Station", position: [45.41365415130087, -75.71371269857259] },
        { name: "Lyon Station", position: [45.418700687465865, -75.70507019475512] },
        { name: "Parliament Station", position: [45.42108866578345, -75.69960247156564] },
        { name: "Rideau Station", position: [45.42621430284704, -75.69203257770035] },
        { name: "uOttawa Station", position: [45.42084556186567, -75.68274113758595] },
        { name: "Lees Station", position: [45.41644163695023, -75.6703536292376] },
        { name: "Hurdman Station", position: [45.41249701692223, -75.66416140563979] },
        { name: "Tremblay Station", position: [45.417057201619755, -75.65337597059792] },
        { name: "St-Laurent Station", position: [45.420761471687186, -75.63655361022633] },
        { name: "Cyrville Station", position: [45.42280385025755, -75.62654004379802] },
        { name: "Blair Station", position: [45.43095978942046, -75.60906646712206] },
        { name: "Montréal Station (Planned Orleans Extension)", position: [45.45145581045082, -75.58363802528353] },
        { name: "Jeanne d'Arc Station (Planned Orleans Extension)", position: [45.46915577014051, -75.54605811606336] },
        { name: "Place d'Orléans Station (Planned Orleans Extension)", position: [45.47977273214435, -75.51772788033654] },
        { name: "Trim Station (Planned Orleans Extension)", position: [45.4951756244525, -75.48046370016701] },

        // Line 2 (Trillium Line) - North to South
        { name: "Bayview Station", position: [45.40930499869428, -75.72212436580328] },
        { name: "Corso Italia Station", position: [45.40435631949416, -75.71494770689033] },
        { name: "Dows Lake Station", position: [45.39764771953156, -75.70984727651627] },
        { name: "Carleton Station", position: [45.38553871989801, -75.69593924325763] },
        { name: "Mooney's Bay Station ", position: [45.377231077407664, -75.68488260431215] },
        { name: "Walkley Station ", position: [45.369006990402504, -75.66588616138051] },
        { name: "Greenboro Station ", position: [45.35992864970454, -75.65924042823674] },
        { name: "South Keys Station", position: [45.35352435568727, -75.65555429914765] },
        { name: "Leitrim Station", position: [45.314001670966185, -75.63202911673999] },
        { name: "Bowesville Station", position: [45.29354606676494, -75.63283643366384] },
        { name: "Limebank Station ", position: [45.277700228414616, -75.66653617595236] },

        // Line 3 One day <//3
        // Line 4 (Airport Line)
        { name: "Uplands Station", position: [45.332970212747114, -75.65596710907316] },
        { name: "Airport Station", position: [45.3234278572354, -75.66827969735849] },

        // S/E Transitway Stations
        { name: "Lycée Claudel Transitway Station", position: [45.40655214295799, -75.66436044750714] },
        { name: "Smyth Transitway Station", position: [45.401273971236016, -75.66651298626053] },
        { name: "Riverside Transitway Station", position: [45.39680924758597, -75.6692467300034] },
        { name: "Pleasant Park Transitway Station", position: [45.3928331385414, -75.66935116962729] },
        { name: "Billings Bridge Transitway Station", position: [45.384798670270044, -75.67697410408013] },
        { name: "Heron Transitway Station", position: [45.37891151057462, -75.67972836894172] },

        // N/W Transitway Stations
        { name: "Westboro Transitway Station", position: [45.396448706073485, -75.75183405552582] },
        { name: "Dominion Transitway Station", position: [45.392566790568644, -75.76039850931966] },
        { name: "Lincoln Fields Transitway Station", position: [45.36645499360978, -75.78322396305443] },
        { name: "Iris Transitway Station", position: [45.35578152336258, -75.77047136564373] },
        { name: "Baseline Transitway Station", position: [45.347407504681, -75.76156902704345] },

        // SW Transitway Stations
        { name: "Fallowfield Transitway Station", position: [45.298906087888646, -75.73624884725515] },
        { name: "Longfields Transitway Station", position: [45.2854755741454, -75.74676820539247] },
        { name: "Strandherd Transitway Station", position: [45.27318122312434, -75.74544637728967] },
        { name: "Marketplace Transitway Station", position: [45.26945927573397, -75.74268966201937] },
        { name: "Barrhaven Centre Transitway Station", position: [45.266877918044436, -75.74148113223286] },

        // W Transitway Stations
        { name: "Queensway Transitway Station", position: [45.35937818808917, -75.77203838456442] },
        { name: "Pinecrest Transitway Station", position: [45.35070445325828, -75.79126293483128] },
        { name: "Bayshore Transitway Station", position: [45.34589828711367, -75.80997417656606] },
        { name: "Moodie Transitway Station", position: [45.34066047461712, -75.84156880282346] },
        { name: "Eagleson Transitway Station", position: [45.31961096037645, -75.88378714428184] },
        { name: "Terry Fox Transitway Station", position: [45.30952331423095, -75.90679115366981] },
        { name: "Innovation Transitway Station", position: [45.343356919415484, -75.9310734819324] },


];

// Define a route
router.get('/', (req, res) => {
    res.send({'message': 'Pins Main Route'});
});

// Define a route
router.get('/all', (req, res) => {
    res.send(pins);
});


// export the router module so that server.js file can use it
module.exports = router;