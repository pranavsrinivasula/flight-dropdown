// controllers/flightTypeController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const fs = require("fs");
const path = require("path");

let userFlightSelection = {};

exports.handleFlightType = async (req, res) => {
  try {
    console.log("🚀 Incoming Request Body:", req.body);

    // 1️⃣ Load private key
    const privateKeyPath = process.env.PRIVATE_KEY;
    console.log("🔑 Looking for private key at:", privateKeyPath);

    if (!fs.existsSync(privateKeyPath)) {
      console.error("❌ Private key not found at", privateKeyPath);
      throw new FlowEndpointException(500, "Private key missing on server");
    }

    const privatePem = fs.readFileSync(privateKeyPath, "utf8");
    const passphrase = process.env.PRIVATE_KEY_PASSPHRASE || "";

    // 2️⃣ Try decrypting the request
    console.log("🧩 Starting decryption...");
    const decrypted = decryptRequest(req.body, privatePem, passphrase);
    console.log("✅ Decryption success!");

    const { decryptedBody, aesKeyBuffer, ivBuffer } = decrypted;
    console.log("📦 Decrypted body:", decryptedBody);

    // 3️⃣ Extract trigger and user data
    const trigger = decryptedBody?.trigger;
    const userId = decryptedBody?.user_id || "guest";
    let currentSelection = userFlightSelection[userId] || "";

    console.log("👤 User:", userId, "Trigger:", trigger);

    // 4️⃣ Update selection
    if (trigger === "chipper") {
      const selected = decryptedBody?.Type_Flight;
      console.log("✈️ Selected Flight Type:", selected);
      if (selected && ["One-Way", "Return"].includes(selected)) {
        userFlightSelection[userId] = selected;
        currentSelection = selected;
      } else {
        console.warn("⚠️ Invalid selection received:", selected);
      }
    }

    // 5️⃣ Prepare flow response
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

    console.log("🧠 Response prepared:", JSON.stringify(responseBody, null, 2));

    // 6️⃣ Encrypt response
    const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
    console.log("🔐 Encryption success!");

    // 7️⃣ Send encrypted response
    res.status(200).json({
      encrypted_flow_data: encryptedResponse,
    });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    if (error instanceof FlowEndpointException) {
      res.status(error.statusCode).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
  }
};
