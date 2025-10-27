// controllers/flightTypeController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const fs = require("fs");
const path = require("path");

// store user selection in memory (can later move to DB)
let userFlightSelection = {};

exports.handleFlightType = async (req, res) => {
  try {
    // Load private key
    const privatePem = fs.readFileSync(path.join(__dirname, "../keys/private.pem"), "utf8");
    const passphrase = process.env.PRIVATE_KEY_PASSPHRASE || "";

    // Step 1: Decrypt incoming request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body, privatePem, passphrase);

    console.log("🛫 Decrypted Payload:", decryptedBody);

    const trigger = decryptedBody?.trigger;
    const userId = decryptedBody?.user_id || "guest"; // sample unique user
    let currentSelection = userFlightSelection[userId] || "";

    // Step 2: If trigger == "chipper", update flight type selection
    if (trigger === "chipper") {
      const selected = decryptedBody?.Type_Flight;
      if (selected && ["One-Way", "Return"].includes(selected)) {
        userFlightSelection[userId] = selected;
        currentSelection = selected;
        console.log(`✅ Updated Flight_Type for ${userId}:`, selected);
      }
    }

    // Step 3: Prepare Meta-compliant Flow response
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
                "init-value": currentSelection ? currentSelection : "",
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

    // Step 4: Encrypt response
    const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);

    // Step 5: Send encrypted response
    res.status(200).json({
      encrypted_flow_data: encryptedResponse,
    });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    if (error instanceof FlowEndpointException) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
};
