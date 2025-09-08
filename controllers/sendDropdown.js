// flowController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err));

/**
 * Master response options (for dropdowns, etc.)
 */
const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    travellers: [
      { id: "T1", title: "1 Traveller" },
      { id: "T2", title: "2 Travellers" }
    ],
    business_units: [
      { id: "BU1", title: "Sales" },
      { id: "BU2", title: "Engineering" }
    ],
    cost_centres: [
      { id: "CC1", title: "Cost Centre 1" },
      { id: "CC2", title: "Cost Centre 2" }
    ]
  }
};

/**
 * Webhook entry
 */
const flowWebhook = async (req, res) => {
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
  const { screen, data } = decryptedBody;

  const screenResponse = await getNextScreen(screen, data, decryptedBody.userId);
  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

/**
 * Screen logic
 */
const getNextScreen = async (currentScreenId, inputData = {}, userId) => {
  try {
    // ---------------- FLIGHT_BOOKING_SCREEN ----------------
    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {
      const { travellers, business_unit, cost_centre } = inputData;

      // Validation
      const errors = [];
      if (!travellers) errors.push("Travellers selection is required");
      if (!business_unit) errors.push("Business unit selection is required");
      if (!cost_centre) errors.push("Cost centre selection is required");

      if (errors.length > 0) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: errors.join(", "),
            travellers_options: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.travellers,
            business_unit_options: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.business_units,
            cost_centre_options: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cost_centres
          }
        };
      }

      // Save booking
      await Booking.create({ userId, travellers, business_unit, cost_centre });

      // Go to SUMMARY_SCREEN
      return {
        screen: "SUMMARY_SCREEN",
        data: {
          confirm_details: [
            `Travellers: ${travellers}`,
            `Business Unit: ${business_unit}`,
            `Cost Centre: ${cost_centre}`
          ],
          confirm_checkbox: true // ✅ Default ticked checkbox
        }
      };
    }

    // ---------------- SUMMARY_SCREEN ----------------
    if (currentScreenId === "SUMMARY_SCREEN") {
      return {
        screen: "TERMINAL_SCREEN",
        data: {
          status: "✅ Booking Confirmed"
        }
      };
    }

    // ---------------- FALLBACK ----------------
    return {
      screen: "TERMINAL_SCREEN",
      data: { status: "✅ Booking Confirmed" }
    };

  } catch (error) {
    console.error("❌ Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowWebhook, getNextScreen };
