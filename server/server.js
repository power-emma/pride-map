const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Prevent DB connection drops or other async errors from silently
// killing the process with no log trace.
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, '— reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

app.get('/', (req, res) => {
    res.send('We are Live!');
});

const pinsRoute = require('./routes/pins');
const cardsRoute = require('./routes/cards');
const categoriesRoute = require('./routes/categories');
const locationsRoute = require('./routes/locations');


app.use('/pins', pinsRoute);
app.use('/cards', cardsRoute);
app.use('/categories', categoriesRoute);
app.use('/locations', locationsRoute);

// Only start the server when this file is run directly, not when imported in tests
if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;

