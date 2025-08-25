// flowController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;
require("dotenv").config();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Atlas connected!"))
  .catch(err => console.error("❌ Mongo error:", err));

const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
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
  }
};

// Helper to format dates
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
  console.log("💬 Decrypted Request:", JSON.stringify(decryptedBody, null, 2));

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", JSON.stringify(screenResponse, null, 2));

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

// Main logic for next screen
const getNextScreen = async (decryptedBody) => {
  const { action, screen, data } = decryptedBody;
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  // Ping check
  if (action === "ping") return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };

  // Initial load
  if (action === "INIT") {
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
        calendar: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate),
          init_value: { start_date: formatDate(today), end_date: formatDate(maxDate) }
        }
      }
    };
  }

  // Handle form submissions
  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: data.from_city || "Not selected",
            to_city: data.to_city || "Not selected",
            Startdate: data.Startdate || "Not selected",
            Enddate: data.Enddate || "Not selected"
          }
        };

      case "SUMMARY_SCREEN":
        // Save booking to MongoDB
        try {
          const bookingData = {
            from_city: data.from_city || "Not selected",
            to_city: data.to_city || "Not selected",
            start_date: data.Startdate || "Not selected",
            end_date: data.Enddate || "Not selected",
            phone_number: "6301015711"
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

      default:
        return SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN;
    }
  }

  // Fallback: initial screen
  return {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
      cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
      calendar: {
        min_date: formatDate(today),
        max_date: formatDate(maxDate),
        init_value: { start_date: formatDate(today), end_date: formatDate(maxDate) }
      }
    }
  };
};

module.exports = { flowWebhook, getNextScreen };
