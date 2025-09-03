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
const getNextScreen = async (decryptedBody) => {
  const { action, screen, data } = decryptedBody;
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  if (action === "ping") return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };

  // INIT or FLIGHT_BOOKING_SCREEN
  if (action === "INIT" || screen === "FLIGHT_BOOKING_SCREEN") {
    // If name is not entered yet, show error and keep age visible
    if (!data?.name) {
      return {
        screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
      cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
      calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
      enddate_visible: { value: !!data?.Startdate },
      error: "Please enter Name first",
      is_age_enabled: false
        }
      };
    }

    // Normal flow when name is present
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
        calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
        enddate_visible: { value: !!data?.Startdate },
        is_age_enabled: true
      }
    };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: data.from_city || { id: "NA", title: "Not selected" },
            to_city: data.to_city || { id: "NA", title: "Not selected" },
            Startdate: { value: data.Startdate || null },
            Enddate: { value: data.Enddate || null },
            name: data.name || "",
            age: data.age || "",
            is_age_enabled: true
          }
        };

      case "SUMMARY_SCREEN":
        try {
          if (!data.Startdate) throw new Error("Startdate is required");
          if (data.Enddate && new Date(data.Enddate) < new Date(data.Startdate)) {
            throw new Error("Enddate cannot be before Startdate");
          }
          if (!data.name) throw new Error("Name is required");
          if (!data.age) throw new Error("Age is required");

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
              enddate_visible: { value: !!data.Startdate },
              is_age_enabled: true,
              error: err.message
            }
          };
        }

        return {
          screen: "TERMINAL_SCREEN",
          data: {
            message: "Booking flow complete",
            trip_summary: {
              from_city: data.from_city,
              to_city: data.to_city,
              Startdate: data.Startdate,
              Enddate: data.Enddate,
              name: data.name,
              age: data.age
            }
          }
        };
    }
  }

  return {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
      cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
      calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
      enddate_visible: { value: false },
      is_age_enabled: true
    }
  };
};

module.exports = { flowWebhook, getNextScreen };
