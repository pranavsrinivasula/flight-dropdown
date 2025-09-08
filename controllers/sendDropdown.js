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

    // ---------------- FLIGHT_BOOKING_SCREEN ----------------
    if (currentScreenId === "FLIGHT_BOOKING_SCREEN") {
      const { from_city, to_city, Startdate, Enddate } = inputData;

      // Dynamic "to_city" options
      const toCityOptions = from_city
        ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== from_city)
        : SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities;

      // Validation
      const errors = [];
      if (!from_city) errors.push("From city is required");
      if (!to_city) errors.push("To city is required");
      if (from_city && to_city && from_city === to_city) errors.push("From and To city cannot be the same");
      if (!Startdate) errors.push("Startdate is required");
      if (!Enddate) errors.push("Enddate is required");
      if (Startdate && Enddate && new Date(Enddate) < new Date(Startdate))
        errors.push("Enddate cannot be before Startdate");

      if (errors.length > 0) {
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            error: errors.join(", "),
            from_city,
            to_city,
            Startdate,
            Enddate,
            to_city_options: toCityOptions,
            calendar: {
              min_date: formatDate(today),
              max_date: formatDate(maxDate),
              init_value: { start_date: formatDate(today), end_date: formatDate(maxDate) }
            }
          }
        };
      }

      // All validations passed, save booking
      await Booking.create({ userId, from_city, to_city, Startdate, Enddate });

      return {
        screen: "SUMMARY_SCREEN",
        data: { from_city, to_city, Startdate, Enddate }
      };
    }

    // ---------------- SUMMARY_SCREEN ----------------
   if (currentScreenId === "SUMMARY_SCREEN") {
  const { from_city, to_city, Startdate, Enddate } = inputData;

  // If user clicked Continue on SUMMARY_SCREEN, then go to TERMINAL
  if (inputData._proceed) {
    return {
      screen: "TERMINAL_SCREEN",
      data: { status: "active" }
    };
  }

  // Otherwise, just show the summary data
  return {
    screen: "SUMMARY_SCREEN",
    data: { from_city, to_city, Startdate, Enddate }
  };
}

    // ---------------- FALLBACK ----------------
    return { screen: "TERMINAL_SCREEN", data: { status: "Booking confirmed" } };

  } catch (error) {
    console.error("Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowWebhook, getNextScreen };
