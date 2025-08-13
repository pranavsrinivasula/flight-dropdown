const { decryptRequest, encryptResponse, isRequestSignatureValid } = require("../middleware/encryption");

const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");
const PASSPHRASE = process.env.PASSPHRASE || "";

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

    // 1️⃣ Validate signature first
    if (!isRequestSignatureValid(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2️⃣ Parse raw body (req.body must be a Buffer)
    let encryptedBody = req.body;
    if (Buffer.isBuffer(encryptedBody)) {
      encryptedBody = JSON.parse(encryptedBody.toString("utf8"));
    }

    // 3️⃣ Decrypt request
    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest(
      encryptedBody,
      PRIVATE_KEY,
      PASSPHRASE
    );

    console.log("Decrypted Body:", decryptedBody);

    // 4️⃣ Build response with proper structure: { screen, data }
    let response;

    if (decryptedBody.action === "INIT") {
      response = {
        screen: SCREEN_RESPONSES.Flight_Booking.screen,
        data: { ...SCREEN_RESPONSES.Flight_Booking.data }
      };
    } else if (
      decryptedBody.action === "data_exchange" &&
      decryptedBody.screen === "FLIGHT_BOOKING_SCREEN"
    ) {
      response = {
        screen: SCREEN_RESPONSES.Summary.screen,
        data: { ...SCREEN_RESPONSES.Summary.data }
      };
    } else {
      response = { data: { message: "No matching action" } };
    }

    // 5️⃣ Encrypt response and send
    const encryptedResponse = encryptResponse(response, aesKeyBuffer, initialVectorBuffer);
    return res.json(encryptedResponse);

  } catch (error) {
    console.error("Error in flowWebhook:", error);
    return res.status(error.statusCode || 400).json({ error: error.message || "Failed to decrypt request" });
  }
};

module.exports = {
  flowWebhook,
};
