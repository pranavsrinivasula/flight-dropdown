// flowController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const mongoose = require("mongoose");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err));

// Sample flight data
const FLIGHT_LIST = [
  { id: "AI203", title: "Air India AI-203" },
  { id: "6E512", title: "IndiGo 6E-512" },
  { id: "UK811", title: "Vistara UK-811" }
];

/**
 * Webhook entry point
 */
const flowWebhook = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key is empty");
    if (!isRequestSignatureValid(req)) return res.status(432).send();

    let decryptedRequest;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error("❌ Decryption failed:", err);
      if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
    const { screen, data, userId, trigger } = decryptedBody;

    const responsePayload = await getNextScreen(screen, data || {}, trigger);
    const encrypted = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
    return res.send(encrypted);

  } catch (err) {
    console.error("❌ flowWebhook error:", err);
    return res.status(500).send();
  }
};

/**
 * Screen navigation logic
 */
const getNextScreen = async (currentScreenId, inputData = {}, trigger) => {
  try {
    // ----------- SEARCH SCREEN -----------
    if (currentScreenId === "SEARCH") {
      // If user clicked "Show Flights List" link → populate flight list
      if (trigger === "FETCH_FLIGHTS") {
        return {
          screen: "SEARCH",
          data: {
            Available_flights_list_temp: FLIGHT_LIST
          }
        };
      }

      // If user selected a flight from dropdown
      if (inputData.selected_flight) {
        return {
          screen: "SEARCH",
          data: {
            Available_flights_list_temp: FLIGHT_LIST,
            selected_flight_option: inputData.selected_flight
          }
        };
      }

      // Initial load → empty flight list
      return {
        screen: "SEARCH",
        data: {
          Available_flights_list_temp: [],
          selected_flight_option: ""
        }
      };
    }

    // ----------- TERMINAL SCREEN -----------
    if (currentScreenId === "TERMINAL_SCREEN") {
      return {
        screen: "TERMINAL_SCREEN",
        data: { status: "active" }
      };
    }

    // ----------- Fallback -----------
    return { data: { status: "active" } };

  } catch (error) {
    console.error("❌ Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowWebhook, getNextScreen };
