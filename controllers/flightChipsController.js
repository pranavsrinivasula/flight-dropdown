// src/controllers/flightChipsController.js
exports.handleFlightType = async (req, res) => {
  try {
    // Just return a static flow with chip selector
    const responseFlow = {
      version: "7.1",
      data_api_version: "3.0",
      screens: [
        {
          id: "SEARCH",
          title: "Flight Type Selector",
          terminal: true,
          success: true,
          data: {
            Flight_Type: [], // empty init
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
                "init-value": [], // start empty
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

    return res.json(responseFlow);
  } catch (err) {
    console.error("❌ Error in handleFlightType:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
