const axios = require('axios');
require('dotenv').config();  // Load environment variables

const sendDropdown = async (req, res) => {
  try {
    const dropdownMessage = {
      messaging_product: 'whatsapp',
      to: req.body.to || 'YOUR_PHONE_NUMBER',  // Replace or pass from frontend/postman
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: 'Flight Booking' },
        body: { text: 'Please select a flight option below:' },
        footer: { text: 'Powered by Sai Pranav Airlines' },
        action: {
          button: 'Show Options',
          sections: [
            {
              title: 'Available Flights',
              rows: [
                {
                  id: 'flight_1',
                  title: 'Hyderabad to Delhi',
                  description: '6:00 AM - 8:30 AM'
                },
                {
                  id: 'flight_2',
                  title: 'Hyderabad to Mumbai',
                  description: '9:00 AM - 11:15 AM'
                }
              ]
            }
          ]
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      dropdownMessage,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
        }
      }
    );

    res.status(200).json({ message: 'Dropdown sent successfully', response: response.data });
  } catch (error) {
    console.error('Error sending dropdown to WhatsApp:', error.message);
    res.status(500).send('Failed to send dropdown');
  }
};

module.exports = sendDropdown;
