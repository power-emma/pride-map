const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());

app.get('/', (req, res) => {
    res.send('We are Live!');
});

const pinsRoute = require('./routes/pins');
const cardsRoute = require('./routes/cards');


app.use('/pins', pinsRoute);
app.use('/cards', cardsRoute);

// Only start the server when this file is run directly, not when imported in tests
if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;

