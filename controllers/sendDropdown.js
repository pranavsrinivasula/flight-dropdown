const { decryptRequest, encryptResponse } = require("../middleware/encryption");
const crypto = require("crypto");
const { APP_SECRET, PASSPHRASE = "" } = process.env;  

const rawPrivateKey = process.env.PRIVATE_KEY;
if (!rawPrivateKey) throw new Error("Private key missing");

const PRIVATE_KEY = rawPrivateKey.replace(/\\n/g, "\n");  


const SCREEN_RESPONSES = {
  Flight_Booking: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: [
        { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
        { id: "HYD_TO_GOA", title: "HYD TO GOA" },
      ],
    },
  },
  Summary: {
    screen: "SUMMARY_SCREEN",
    data: {
      selected_flight: "Hyderabad to Delhi - Economy Class\nMon Jan 01 2024 at 11:30",
      details: "Passenger: PRANAV\nEmail: john@example.com\nPhone: 123456789\n\nWindow seat, vegetarian meal",
      origin: "Hyderabad",
      destination: "Delhi",
      date: "2024-01-01",
      time: "11:30",
      passenger_name: "John Doe",
      email: "john@example.com",
      phone: "123456789",
      extra_preferences: "Window seat, vegetarian meal",
    },
  },
};




const flowWebhook = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key missing");

    // Validate signature before processing
    if (!isRequestSignatureValid(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Decrypt payload using your decryptRequest function
    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest(
      req.body,
      PRIVATE_KEY,
      PASSPHRASE
    );

    console.log("Decrypted Body:", decryptedBody);

    let response;

    if (decryptedBody.action === "INIT") {
      response = {
        ...SCREEN_RESPONSES.Flight_Booking,
        data: { ...SCREEN_RESPONSES.Flight_Booking.data },
      };
    } else if (
      decryptedBody.action === "data_exchange" &&
      decryptedBody.screen === "FLIGHT_BOOKING_SCREEN"
    ) {
      response = {
        ...SCREEN_RESPONSES.Summary,
        data: { ...SCREEN_RESPONSES.Summary.data },
      };
    } else {
      response = { data: { message: "No matching action" } };
    }

    const encryptedResponse = encryptResponse(response, aesKeyBuffer, initialVectorBuffer);


    return res.json(encryptedResponse) 
    // return res.json(response); 

  } catch (error) {
    console.error("Error in flowWebhook:", error);
    return res.status(error.statusCode || 400).json({ error: error.message || "Failed to decrypt request" });
  }
};



module.exports = {
  flowWebhook,
};
