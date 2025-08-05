const express = require('express');
const app = express();
const sendDropdown = require('./controllers/sendDropdown');

app.use(express.json());

// Route
app.post('/sendlist', sendDropdown);
app.get('/', (req, res) => {
  res.send('Server is running. Use POST /sendlist to trigger WhatsApp message.');
});


// Start server
app.listen(4000, () => console.log('Server running on port 4000'));
