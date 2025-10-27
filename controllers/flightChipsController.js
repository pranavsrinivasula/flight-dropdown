// controllers/flightTypeController.js
exports.handleFlightType = async (req, res) => {
  try {
    const decrypted = decryptRequest(req);
    console.log("✅ Decrypted Request:", decrypted);

    // Extract flight type safely from different sources
    const selectedFlightType =
      decrypted.Type_Flight ||
      decrypted.form?.Flight_Type ||
      decrypted.Flight_Type ||
      null;

    if (!selectedFlightType) {
      throw new FlowEndpointException(400, "Missing Type_Flight in decrypted payload");
    }

    // Build ChipsSelector flow
    const responseData = {
      version: "7.1",
      data_api_version: "3.0",
      screens: [
        {
          id: "SEARCH",
          title: "Flight Type Selector",
          terminal: true,
          success: true,
          data: {
            Flight_Type: [selectedFlightType],
          },
          layout: {
            type: "SingleColumnLayout",
            children: [
              {
                type: "ChipsSelector",
                name: "Flight_Type",
                label: "🛫 Book Your Flight",
                description: "Choose your flight type:",
                required: true,
                enabled: true,
                "init-value": [selectedFlightType],
                "data-source": [
                  { id: "2", title: "Return" },
                  { id: "1", title: "One-Way" },
                ],
                "on-select-action": {
                  name: "data_exchange",
                  payload: {
                    trigger: "chipper",
                    Type_Flight: "${form.Flight_Type}",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const encryptedResponse = encryptResponse(responseData);
    return res.status(200).json({
      success: true,
      encrypted_flow_data: encryptedResponse,
    });
  } catch (err) {
    console.error("❌ Error in handleFlightType:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};
