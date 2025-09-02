const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

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

const formatDate = (date) => date.toISOString().split("T")[0];

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

const getNextScreen = async (decryptedBody) => {
  const { action, screen, data } = decryptedBody;
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  // Initial load
  if (action === "INIT" || screen === "FLIGHT_BOOKING_SCREEN") {
    let enddateMin;

    // If Startdate selected, allow Enddate from Startdate onward
    if (data?.Startdate) {
      enddateMin = data.Startdate;
    } else {
      // Block Enddate until Startdate selected
      const blockDate = new Date();
      blockDate.setDate(maxDate.getDate() + 1);
      enddateMin = blockDate.toISOString().split("T")[0];
    }

    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
        calendar: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate),
          init_value: {
            start_date: data?.Startdate || formatDate(today),
            end_date: data?.Enddate || formatDate(maxDate)
          }
        },
        enddate_min
      }
    };
  }

  // Handle form submission
  if (action === "data_exchange") {
    if (screen === "FLIGHT_BOOKING_SCREEN") {
      // If Enddate is selected without Startdate → reload screen blocking Enddate
      if (!data.Startdate) {
        const blockDate = new Date();
        blockDate.setDate(maxDate.getDate() + 1);
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
            cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
            calendar: {
              min_date: formatDate(today),
              max_date: formatDate(maxDate),
              init_value: {
                start_date: formatDate(today),
                end_date: formatDate(maxDate)
              }
            },
            enddate_min: blockDate.toISOString().split("T")[0]
          }
        };
      }

      // Both Startdate selected → allow Enddate
      return {
        screen: "SUMMARY_SCREEN",
        data: {
          from_city: data.from_city || "Not selected",
          to_city: data.to_city || "Not selected",
          Startdate: data.Startdate,
          Enddate: data.Enddate || data.Startdate
        }
      };
    }

    // Summary screen → save booking
    if (screen === "SUMMARY_SCREEN") {
      try {
        await Booking.create({
          from_city: data.from_city,
          to_city: data.to_city,
          start_date: data.Startdate,
          end_date: data.Enddate,
          phone_number: "6301015711"
        });
      } catch (err) {
        console.error("❌ Booking save error:", err);
      }

      return {
        screen: "TERMINAL_SCREEN",
        data: { message: "Booking flow complete" }
      };
    }
  }

  // Fallback
  return { screen: "FLIGHT_BOOKING_SCREEN", data: {} };
};

module.exports = { flowWebhook, getNextScreen };
