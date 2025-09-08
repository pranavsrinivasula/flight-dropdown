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

  const { screen, data } = decryptedBody;

  const screenResponse = await getNextScreen(screen, data, decryptedBody.userId);
  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

// Main logic
const getNextScreen = async (currentScreenId, inputData = {}, userId) => {
  try {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 365);

    // Defensive input parsing
    const fromCityId = inputData.from_city || "";
    const toCityId = inputData.to_city || "";
    const start_date = inputData.start_date || "";
    const end_date = inputData.end_date || "";
    const name = inputData.name || "";
    const age = inputData.age || "";

    // Dynamic to_city options
    const toCityOptions = fromCityId
      ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== fromCityId)
      : SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities;

    const isToCityEnabled = !!fromCityId;
    const toCityVisible = !!fromCityId;

    // ---------------- FLIGHT_BOOKING_SCREEN ----------------
    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {

      // Validation errors
      const errors = [];
      if (!fromCityId) errors.push("From city is required");
      if (!toCityId) errors.push("To city is required");
      if (fromCityId && toCityId && fromCityId === toCityId) errors.push("From and To city cannot be the same");
      if (!start_date) errors.push("Start date is required");
      if (!end_date) errors.push("End date is required");
      if (start_date && end_date && new Date(end_date) < new Date(start_date)) errors.push("End date cannot be before start date");
      if (!name) errors.push("Name is required");
      if (!age && !!fromCityId) errors.push("Age is required");

      if (errors.length > 0) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: errors.join(", "),
            from_city: fromCityId,
            to_city: toCityId,
            start_date,
            end_date,
            to_city_options: toCityOptions,
            is_age_enabled: !!fromCityId,
            is_to_city_enabled: isToCityEnabled,
            to_city_visible: toCityVisible,
            enddate_visible: { value: !!start_date },
            calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
            trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
            cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities
          }
        };
      }

      // All validations passed, save booking
      await Booking.create({
        userId,
        from_city: fromCityId,
        to_city: toCityId,
        start_date,
        end_date,
        name,
        age
      });

      return {
        screen: "SUMMARY_SCREEN",
        data: {
          from_city: fromCityId,
          to_city: toCityId,
          start_date,
          end_date,
          name,
          age
        }
      };
    }

    // ---------------- SUMMARY_SCREEN ----------------
    if (currentScreenId === "SUMMARY_SCREEN") {
      return {
        screen: "TERMINAL_SCREEN",
        data: { status: "Booking confirmed" }
      };
    }

    // ---------------- FALLBACK ----------------
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        from_city: "",
        to_city: "",
        start_date: "",
        end_date: "",
        to_city_options: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
        is_age_enabled: false,
        is_to_city_enabled: false,
        to_city_visible: false,
        enddate_visible: { value: false },
        calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities
      }
    };
  } catch (error) {
    console.error("Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};




module.exports = { flowWebhook, getNextScreen };
