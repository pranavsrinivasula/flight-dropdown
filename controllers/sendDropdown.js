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

    // Normalize from_city and to_city (object or string)
    const fromCityId =
      inputData.from_city && typeof inputData.from_city === "object"
        ? inputData.from_city.id
        : inputData.from_city;
    const toCityId =
      inputData.to_city && typeof inputData.to_city === "object"
        ? inputData.to_city.id
        : inputData.to_city;

    const { start_date, end_date } = inputData;

    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {
      // Dynamic "to_city" options
      const toCityOptions = fromCityId
        ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== fromCityId)
        : [{ id: "", title: "Select From City first" }];

      // Validation: From & To cannot be same
      if (fromCityId && toCityId && fromCityId === toCityId) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: "From and To city cannot be the same",
            from_city: inputData.from_city,
            to_city: inputData.to_city,
            to_city_options: toCityOptions,
            is_age_enabled: !!fromCityId,
            is_to_city_enabled: !!fromCityId,
            to_city_visible: !!fromCityId,
            enddate_visible: { value: !!start_date },
            calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
            trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
            cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities
          }
        };
      }

      // Validation: End date after start date
      if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: "End date cannot be before start date",
            from_city: inputData.from_city,
            to_city: inputData.to_city,
            to_city_options: toCityOptions,
            is_age_enabled: !!fromCityId,
            is_to_city_enabled: !!fromCityId,
            to_city_visible: !!fromCityId,
            enddate_visible: { value: !!start_date },
            calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
            trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
            cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities
          }
        };
      }

      // Proceed if all required fields filled
      if (fromCityId && toCityId && start_date && end_date) {
        await Booking.create({
          userId,
          from_city: fromCityId,
          to_city: toCityId,
          start_date,
          end_date
        });

        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: fromCityId,
            to_city: toCityId,
            start_date,
            end_date,
            name: inputData.name,
            age: inputData.age
          }
        };
      }

      // Return same screen with updated options & flags
      return {
        screen: "FLIGHT_BOOKING_SCREEN",
        data: {
          from_city: inputData.from_city,
          to_city: inputData.to_city,
          start_date,
          end_date,
          to_city_options: toCityOptions,
          is_age_enabled: !!fromCityId,
          is_to_city_enabled: !!fromCityId,
          to_city_visible: !!fromCityId,
          enddate_visible: { value: !!start_date },
          calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
          trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
          cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities
        }
      };
    }

    // SUMMARY_SCREEN → TERMINAL_SCREEN
    if (currentScreenId === "SUMMARY_SCREEN") {
      return {
        screen: "TERMINAL_SCREEN",
        data: { status: "Booking confirmed" }
      };
    }

    // Default fallback
    return { screen: "TERMINAL_SCREEN", data: { status: "Booking confirmed" } };
  } catch (error) {
    console.error("Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowWebhook, getNextScreen };
