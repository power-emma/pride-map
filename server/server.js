const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());

app.get('/', (req, res) => {
    res.send('We are Live!');
});

const pinsRoute = require('./routes/pins');


app.use('/pins', pinsRoute);

const port = process.env.PORT || 3001;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

