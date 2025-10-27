const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const flightTypeRoutes = require('./Routes/routes');


dotenv.config();
const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use('/', flightTypeRoutes);


app.use((err, req, res, next) => {
console.error('Unhandled Error:', err);
res.status(500).json({ success: false, message: 'Internal server error' });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));