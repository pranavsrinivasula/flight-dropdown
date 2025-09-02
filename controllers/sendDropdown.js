const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas connected!"))
  .catch(err => console.error("❌ Mongo error:", err));

// Cities and trips
const CITIES = [
  { id: "HYD", title: "Hyderabad" },
  { id: "MUM", title: "Mumbai" },
  { id: "GOA", title: "Goa" }
];

const TRIPS = [
  { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
  { id: "HYD_TO_GOA", title: "HYD TO GOA" }
];

// Helper to format dates
const formatDate = (date) => date.toISOString().split("T")[0];

// Build Flight Booking screen
const buildFlightBookingScreen = (startDate, endDate) => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  const start = startDate || formatDate(today);
  const end = endDate || start; // default end = start

  return {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: TRIPS,
      cities: CITIES,
      calendar: {
        min_date: formatDate(today),
        max_date: formatDate(maxDate),
        init_value: { start_date: start, end_date: end }
      },
      enddate_min: start // dynamic min-date for Enddate
    }
  };
};

// Build Summary screen
const buildSummaryScreen = (formData) => {
  // Find city titles
  const fromCity = CITIES.find(c => c.id === formData.from_city)?.title || formData.from_city;
  const toCity = CITIES.find(c => c.id === formData.to_city)?.title || formData.to_city;

  return {
    screen: "SUMMARY_SCREEN",
    data: {
      from_city: fromCity,
      to_city: toCity,
      Startdate: formData.Startdate,
      Enddate: formData.Enddate
    }
  };
};

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
  console.log("💬 Decrypted Request:", JSON.stringify(decryptedBody, null, 2));

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", JSON.stringify(screenResponse, null, 2));

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

// Main logic for next screen
const getNextScreen = async (decryptedBody) => {
  const { action, screen, data } = decryptedBody;

  if (action === "ping") return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };

  if (action === "INIT") return buildFlightBookingScreen(null, null);

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN": {
        const startDate = data.Startdate || null;
        const endDate = data.Enddate || null;

        // If Startdate not selected, reload screen
        if (!startDate) return buildFlightBookingScreen(null, null);

        // Return Flight Booking screen with dynamic Enddate min
        return buildFlightBookingScreen(startDate, endDate);
      }

      case "SUMMARY_SCREEN": {
        try {
          const bookingData = {
            from_city: data.from_city,
            to_city: data.to_city,
            start_date: data.Startdate,
            end_date: data.Enddate,
            phone_number: data.phone_number || "6301015711"
          };
          const saved = await Booking.create(bookingData);
          console.log("✅ Booking saved:", saved);
        } catch (err) {
          console.error("❌ Error saving booking:", err);
        }

        return {
          screen: "TERMINAL_SCREEN",
          data: {
            message: "Booking flow complete",
            trip_summary: {
              from_city: data.from_city,
              to_city: data.to_city,
              Startdate: data.Startdate,
              Enddate: data.Enddate
            }
          }
        };
      }
    }
  }

  return buildFlightBookingScreen(null, null);
};

module.exports = { flowWebhook, getNextScreen };
