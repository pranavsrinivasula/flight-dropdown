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
  .then(() => console.log("✅ MongoDB Atlas connected!"))
  .catch(err => console.error("❌ Mongo error:", err));

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
        cities: [
          { id: "HYD", title: "Hyderabad" },
          { id: "MUM", title: "Mumbai" },
          { id: "GOA", title: "Goa" }
        ],
        calendar: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate)
        },
        enddate_enabled: { value: false } // Enddate disabled initially
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
            from_city: { id: data.from_city, title: data.from_city },
            to_city: { id: data.to_city, title: data.to_city },
            Startdate: { value: data.Startdate },
            Enddate: { value: data.Enddate || data.Startdate },
          }
        };

      case "SUMMARY_SCREEN":
        try {
          const bookingData = {
            from_city: data.from_city.title,
            to_city: data.to_city.title,
            start_date: data.Startdate.value,
            end_date: data.Enddate.value,
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
              from_city: data.from_city.title,
              to_city: data.to_city.title,
              Startdate: data.Startdate.value,
              Enddate: data.Enddate.value
            }
          }
        };

      default:
        return { screen: "FLIGHT_BOOKING_SCREEN", data: {} };
    }
  }

  // Default fallback
  return { screen: "FLIGHT_BOOKING_SCREEN", data: {} };
};

module.exports = { flowWebhook, getNextScreen };
