const sendDropdown = async (req, res) => {
  try {
    const dropdownMessage = {
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

    res.status(200).json(dropdownMessage);
  } catch (error) {
    console.error('Error generating dropdown message:', error.message);
    res.status(500).send('Failed to generate dropdown');
  }
};

module.exports = sendDropdown;
