// controllers/flightTypeController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

let userFlightSelection = {};

exports.handleFlightType = async (req, res) => {
  try {
    console.log("🚀 Incoming Request Body:", req.body);

    // 1️⃣ Decrypt
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    console.log("✅ Decrypted Body:", decryptedBody);

    // 2️⃣ Handle user selection
    const trigger = decryptedBody?.trigger;
    const userId = decryptedBody?.user_id || "guest";
    let currentSelection = userFlightSelection[userId] || "";

    if (trigger === "chipper") {
      const selected = decryptedBody?.Type_Flight;
      if (selected && ["One-Way", "Return"].includes(selected)) {
        userFlightSelection[userId] = selected;
        currentSelection = selected;
      }
    }

    // 3️⃣ Prepare flow response
    const responseBody = {
      version: "1.0",
      data: {
        screens: [
          {
            id: "flight_type_screen",
            title: "Flight Booking",
            fields: [
              {
                type: "ChipsSelector",
                name: "Flight_Type",
                label: "🛫 Book Your Flight",
                description: "Choose where you want to fly from to begin your booking :",
                required: true,
                enabled: true,
                "init-value": currentSelection,
                "data-source": [
                  { id: "1", title: "One-Way" },
                  { id: "2", title: "Return" },
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
        ],
      },
    };

    // 4️⃣ Encrypt and respond
    const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
    res.status(200).json({ encrypted_flow_data: encryptedResponse });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    const status = error instanceof FlowEndpointException ? error.statusCode : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};
