const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

let availableFlightsListTemp = [];
let selectedFlightOption = "";
let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(req.body);

    const { trigger, selected_result } = decryptedBody;

    if (trigger === "Enable_Search_Field") isSearchEnabled = true;

    if (trigger === "Flight_Selected" && selected_result) {
      availableFlightsListTemp = [selected_result];
      selectedFlightOption = selected_result.title;
    }

    if (trigger === "Data_Submitted") {
      console.log("Booking Data Received:", decryptedBody);
    }

    const responseData = {
      data: {
        status: "active",
        is_search_enabled: isSearchEnabled,
        Available_flights_list_temp: availableFlightsListTemp,
        selected_flight_option: selectedFlightOption,
      },
    };

    const encryptedPayload = encryptResponse(responseData, aesKeyBuffer, initialVectorBuffer);
    return res.json({ encrypted_flow_data: encryptedPayload });
  } catch (err) {
    console.error("❌ flowController error:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { flowController };
