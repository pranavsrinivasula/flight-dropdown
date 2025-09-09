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
 * Options used by the FLIGHT_BOOKING_SCREEN
 */
const SCREEN_OPTIONS = {
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
    ],
    confirm_details_default: "true"
  }
};

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
    const { screen, data, userId } = decryptedBody;

    const responsePayload = await getNextScreen(screen, data || {}, userId);
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
const getNextScreen = async (currentScreenId, inputData = {}, userId) => {
  try {
    // ----------- FLIGHT_BOOKING_SCREEN -----------
    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {
      const { travellers, business_unit, cost_centre } = inputData;
      const isInitialLoad = !travellers && !business_unit && !cost_centre;

      if (isInitialLoad) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            travellers: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.travellers,
            business_units: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.business_units,
            cost_centres: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.cost_centres,
            confirm_details: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.confirm_details_default,
          },
        };
      }

      const errors = [];
      if (!travellers) errors.push("Travellers selection is required");
      if (!business_unit) errors.push("Business unit selection is required");
      if (!cost_centre) errors.push("Cost centre selection is required");

      if (errors.length > 0) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: errors.join(", "),
            travellers: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.travellers,
            business_units: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.business_units,
            cost_centres: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.cost_centres,
            confirm_details: SCREEN_OPTIONS.FLIGHT_BOOKING_SCREEN.confirm_details_default,
          },
        };
      }

      // Save booking
      await Booking.create({ userId, travellers, business_unit, cost_centre });

      return {
        screen: "SUMMARY_SCREEN",
        data: {
          from_city: "",
          to_city: "",
          via_city: "",
          final_city: "",
          show_via: false,
          show_final: false,
        },
      };
    }

    // ----------- SUMMARY_SCREEN -----------
    if (currentScreenId === "SUMMARY_SCREEN") {
      const { from_city, to_city, via_city, final_city, show_via, show_final } = inputData;

      // Step 1: after from + to → unlock via
      if (from_city && to_city && !show_via) {
        return {
          screen: "SUMMARY_SCREEN",
          data: { ...inputData, show_via: true },
        };
      }

      // Step 2: after via → unlock final
      if (via_city && !show_final) {
        return {
          screen: "SUMMARY_SCREEN",
          data: { ...inputData, show_final: true },
        };
      }

      // Step 3: after all filled → move to TERMINAL_SCREEN
      if (from_city && to_city && via_city && final_city) {
        return {
          screen: "TERMINAL_SCREEN",
          data: { status: "active" },
        };
      }

      // Default: return same summary
      return {
        screen: "SUMMARY_SCREEN",
        data: inputData,
      };
    }

    // ----------- TERMINAL_SCREEN -----------
    if (currentScreenId === "TERMINAL_SCREEN") {
      return { data: { status: "active" } };
    }

    // ----------- Fallback -----------
    return { data: { status: "active" } };

  } catch (error) {
    console.error("❌ Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowWebhook, getNextScreen };
