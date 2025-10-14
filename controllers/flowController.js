const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// Full flight list
const FLIGHT_LIST = [
  { id: "AI203", title: "Air India AI-203", from: "DEL", to: "JNB" },
  { id: "6E512", title: "IndiGo 6E-512", from: "DEL", to: "CPT" },
  { id: "UK811", title: "Vistara UK-811", from: "BOM", to: "JNB" },
  { id: "EK501", title: "Emirates EK-501", from: "DEL", to: "CPT" },
  { id: "BA142", title: "British Airways BA-142", from: "BOM", to: "JNB" }
];

let availableFlightsListTemp = [];
let selectedFlightOption = "";
let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key is empty");
    if (!isRequestSignatureValid(req)) return res.status(432).send();

    let decryptedRequest;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error("❌ Decryption failed:", err);
      if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
    const { screen, data, trigger } = decryptedBody;

    const responsePayload = await getNextScreen(screen, data || {}, trigger);
    const encrypted = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
    return res.send(encrypted);

  } catch (err) {
    console.error("❌ flowController error:", err);
    return res.status(500).send();
  }
};

const getNextScreen = async (currentScreenId, inputData = {}, trigger) => {
  try {
    if (currentScreenId === "SEARCH") {

      // --- OptIn: Enable Search Fields ---
      if (trigger === "Enable_Search_Field") {
        isSearchEnabled = true;
        return {
          screen: "SEARCH",
          data: {
            Available_flights_list_temp,
            selected_flight_option: selectedFlightOption,
            is_search_enabled: isSearchEnabled
          }
        };
      }

      // --- Booking Submitted ---
      if (trigger === "Data_Submitted") {
        console.log("Booking Data Received:", inputData);

        // Reset after booking
        availableFlightsListTemp = [];
        selectedFlightOption = "";
        isSearchEnabled = false;

        return {
          screen: "SEARCH",
          data: {
            Available_flights_list_temp,
            selected_flight_option: selectedFlightOption,
            is_search_enabled: isSearchEnabled,
            status: "Booking Confirmed",
            message: "Flight successfully booked!"
          }
        };
      }

      // --- Fetch available flights dynamically based on Flying_from and Flying_to ---
      if (trigger === "FETCH_FLIGHTS" || (inputData.Flying_from && inputData.Flying_to)) {
        const filteredFlights = FLIGHT_LIST.filter(f =>
          f.from === inputData.Flying_from && f.to === inputData.Flying_to
        );
        availableFlightsListTemp = filteredFlights;
        return {
          screen: "SEARCH",
          data: {
            Available_flights_list_temp: availableFlightsListTemp,
            selected_flight_option: selectedFlightOption,
            is_search_enabled: isSearchEnabled
          }
        };
      }

      // Default return for SEARCH screen
      return {
        screen: "SEARCH",
        data: {
          Available_flights_list_temp,
          selected_flight_option: selectedFlightOption,
          is_search_enabled: isSearchEnabled
        }
      };
    }

    // Default fallback
    return { data: { status: "active" } };

  } catch (error) {
    console.error("❌ Error in getNextScreen:", error);
    throw new FlowEndpointException("Error processing next screen", error);
  }
};

module.exports = { flowController, getNextScreen };
