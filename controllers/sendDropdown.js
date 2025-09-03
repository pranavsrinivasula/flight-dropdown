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
const getNextScreen = async ({ action, screen, data }) => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  // Health check
  if (action === "ping") return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };

  // INIT / First screen
  if (action === "INIT" || screen === "FLIGHT_BOOKING_SCREEN") {
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
        calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
        is_age_enabled: !!data?.name,
        error: !data?.name ? "Please enter Name first" : undefined
      }
    };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        // If Age filled without Name, block and show error
        if (!data.name && data.age) {
          return {
            screen: "FLIGHT_BOOKING_SCREEN",
            data: {
              trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
              cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
              calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
              is_age_enabled: false,
              error: "Please enter Name first before filling Age"
            }
          };
        }

        // Normal flow when Name is present
        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: data.from_city || "",
            to_city: data.to_city || "",
            Startdate: data.Startdate || "",
            Enddate: data.Enddate || "",
            name: data.name || "",
            age: data.age || "",
            is_age_enabled: !!data?.name
          }
        };

      case "SUMMARY_SCREEN":
        try {
          if (!data.Startdate) throw new Error("Startdate is required");
          if (data.Enddate && new Date(data.Enddate) < new Date(data.Startdate)) {
            throw new Error("Enddate cannot be before Startdate");
          }

          // Save booking
          await Booking.create({
            from_city: data.from_city,
            to_city: data.to_city,
            start_date: data.Startdate,
            end_date: data.Enddate || data.Startdate,
            name: data.name,
            age: data.age,
            phone_number: "6301015711"
          });
        } catch (err) {
          console.error(err.message);
          return {
            screen: "FLIGHT_BOOKING_SCREEN",
            data: {
              trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
              cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
              calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
              is_age_enabled: !!data?.name,
              error: err.message
            }
          };
        }

        return {
          screen: "TERMINAL_SCREEN",
          data: {
            message: "Booking flow complete",
            trip_summary: { ...data }
          }
        };
    }
  }

  // Default fallback
  return {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
      cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
      calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
      is_age_enabled: false
    }
  };
};

module.exports = { flowWebhook, getNextScreen };
