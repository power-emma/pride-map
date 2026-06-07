const express = require('express');
const app = express();
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Last-resort safety nets — these should rarely fire because every route
// already has its own try/catch. Log and keep running.
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
const authRoute = require('./routes/auth');

app.use('/pins', pinsRoute);
app.use('/cards', cardsRoute);
app.use('/categories', categoriesRoute);
app.use('/auth', authRoute);
app.use('/locations', locationsRoute);

// Catch-all Express error handler — fires when a route calls next(err) or
// when an async route throws without a try/catch. Returns JSON 500 instead
// of letting Express send its default HTML error page (or worse, crashing).
// Must be declared after all routes and with exactly four parameters.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled route error:', err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Only start the server when this file is run directly, not when imported in tests
if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;

