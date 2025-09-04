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

  // Initial screen
  if (action === "INIT" || screen === "FLIGHT_BOOKING_SCREEN") {
    const fromCitySelected = data?.from_city;
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
        calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
        enddate_visible: { value: !!data?.Startdate },
        is_age_enabled: !!fromCitySelected,
        // Always enabled, but options depend on from_city selection
        to_city_options: fromCitySelected
          ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== fromCitySelected.id)
          : [{ id: "", title: "Select From City first" }]
      }
    };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        const toCityOptions = data.from_city
          ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== data.from_city.id)
          : [{ id: "", title: "Select From City first" }];

        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
            cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
            calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
            enddate_visible: { value: !!data.Startdate },
            is_age_enabled: !!data.from_city,
            to_city_options: toCityOptions
          }
        };

      case "SUMMARY_SCREEN":
        try {
          if (!data.Startdate) throw new Error("Startdate is required");
          if (data.Enddate && new Date(data.Enddate) < new Date(data.Startdate)) {
            throw new Error("Enddate cannot be before Startdate");
          }

          await Booking.create({
            from_city: data.from_city,
            to_city: data.to_city,
            start_date: data.Startdate,
            end_date: data.Enddate || data.Startdate,
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
              is_age_enabled: false,
              to_city_options: data.from_city
                ? SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities.filter(c => c.id !== data.from_city.id)
                : [{ id: "", title: "Select From City first" }],
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
              Enddate: data.Enddate
            }
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
      enddate_visible: { value: false },
      is_age_enabled: false,
      to_city_options: [{ id: "", title: "Select From City first" }]
    }
  };
};

module.exports = { flowWebhook, getNextScreen };
