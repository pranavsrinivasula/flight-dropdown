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

const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    trip_types: [
      { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
      { id: "HYD_TO_GOA", title: "HYD TO GOA" }
    ],
    cities: [
      { id: "HYD", title: "Hyderabad" },
      { id: "MUM", title: "Mumbai" },
      { id: "GOA", title: "Goa" }
    ]
  }
};

const formatDate = (date) => date.toISOString().split("T")[0];

// Flow Webhook
const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) throw new Error("Private key is empty");
  if (!isRequestSignatureValid(req)) return res.status(432).send();

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  const screenResponse = await getNextScreen(decryptedBody);
  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

// Main logic
const getNextScreen = async (currentScreenId, inputData, userId) => {
  try {
    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {
      const { from_city, to_city, start_date, end_date } = inputData;

      // Filter options dynamically for "to_city"
      const toCityOptions = from_city
        ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(
            (c) => c.id !== from_city.id
          )
        : [{ id: "", title: "Select From City first" }];

      // Validation: prevent same city in from/to
      if (from_city && to_city && from_city === to_city) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: "From and To city cannot be the same",
            to_city_options: toCityOptions,
          },
        };
      }

      // Validation: end_date should not be before start_date
      if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: "End date cannot be before start date",
            to_city_options: toCityOptions,
          },
        };
      }

      // Proceed only if all fields are filled
      if (from_city && to_city && start_date && end_date) {
        await Booking.create({
          userId,
          from_city,
          to_city,
          start_date,
          end_date,
        });

        return {
          screen: "SUMMARY_SCREEN",
          data: { from_city, to_city, start_date, end_date },
        };
      }

      // Return same screen with updated options + UI flags
      return {
        screen: "FLIGHT_BOOKING_SCREEN",
        data: {
          from_city,
          to_city,
          start_date,
          end_date,
          to_city_options: toCityOptions,
          is_age_enabled: !!from_city,
          enddate_visible: { value: !!start_date },
        },
      };
    }

    if (currentScreenId === "SUMMARY_SCREEN") {
      return {
        screen: "TERMINAL_SCREEN",
        data: { message: "Booking completed successfully!" },
      };
    }

    return { screen: "TERMINAL_SCREEN", data: {} };
  } catch (error) {
    console.error("Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};


module.exports = { flowWebhook, getNextScreen };
