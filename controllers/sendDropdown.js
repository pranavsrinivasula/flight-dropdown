const axios = require("axios");
require("dotenv").config();

const sendDropdown = async (req, res) => {

  if (!userPhone) return res.status(400).json({ error: "Missing user phone number" });

  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: '916301015711',
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: "Choose Your Option"
        },
        body: {
          text: "Please select one of the available options:"
        },
        footer: {
          text: "Powered by your service"
        },
        action: {
          button: "Select Option",
          sections: [
            {
              title: "Available Options",
              rows: [
                {
                  id: "opt1",
                  title: "Option 1",
                  description: "Description of option 1"
                },
                {
                  id: "opt2",
                  title: "Option 2",
                  description: "Description of option 2"
                }
              ]
            }
          ]
        }
      }
    };

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    return res.status(200).json({ message: "Dropdown sent!", response: response.data });
  } catch (error) {
    console.error("Error sending dropdown:", error?.response?.data || error.message);
    return res.status(500).json({ error: "Failed to send dropdown", details: error?.response?.data || error.message });
  }
};

module.exports = sendDropdown;
