const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const fs = require("fs");
const crypto = require("crypto"); 

// const PRIVATE_KEY = process.env.PRIVATE_KEY_PATH;
// const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');

// let PRIVATE_KEY = process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"); // Inline key case
// if (!PRIVATE_KEY && process.env.PRIVATE_KEY_PATH) {
//   PRIVATE_KEY = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
// }
const { APP_SECRET,  PASSPHRASE = "" } = process.env;



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

function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn("App Secret missing. Skipping signature validation.");
    return true;
  }
  const signatureHeader = req.get("x-hub-signature-256");
  if (!signatureHeader) return false;

  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "hex");
  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digest = hmac.update(req.rawBody || "").digest();

  return crypto.timingSafeEqual(digest, signatureBuffer);
}
const path = require("path");
require('dotenv').config();
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const PRIVATE_KEY = fs.readFileSync(path.resolve(privateKeyPath), "utf8");
const flowWebhook = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key missing");

    // Validate signature
    if (!isRequestSignatureValid(req)) return res.status(432).send();

    // Decrypt request body
    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest(
      req.body,
      PRIVATE_KEY,
      PASSPHRASE
    );

    console.log("Decrypted Body:", decryptedBody);

    // Handle actions here
    let response;

    if (decryptedBody.action === "INIT") {
      response = SCREEN_RESPONSES.Flight_Booking;
    } else if (decryptedBody.action === "data_exchange" && decryptedBody.screen === "FLIGHT_BOOKING_SCREEN") {
      response = SCREEN_RESPONSES.SUMMARY;
    } else {
      response = { data: { message: "No matching action" } };
    }

    // Encrypt response before sending
    const encryptedResponse = encryptResponse(response, aesKeyBuffer, initialVectorBuffer);
    res.send(encryptedResponse);
    
  } catch (error) {
    console.error("Error in flowWebhook:", error);
    if (error instanceof FlowEndpointException) {
      return res.status(error.statusCode).send();
    }
   console.error("Error in flowWebhook:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });

  }
};

module.exports = {
  flowWebhook,
};
