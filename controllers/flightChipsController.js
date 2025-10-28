const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption.js");
const crypto = require("crypto");

const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "" } = process.env;

const flowWebhook = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key missing in env.");

    // if (!isRequestSignatureValid(req)) return res.status(432).send();

    let decryptedRequest;
    try {
      decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
      console.error("❌ Decryption failed:", err);
      if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
      return res.status(500).send();
    }

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    const screenResponse = await getNextScreen(decryptedBody);
    console.log("👉 Response to Encrypt:", screenResponse);

    res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  } catch (err) {
    console.error("❌ Error in flowWebhook:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getNextScreen = async (decryptedBody) => {
  const { screen, action, data = {}, payload = {} } = decryptedBody;
  const trigger = payload?.trigger;

  if (action === "ping") return { data: { status: "active" } };

  if (data?.error) {
    console.warn("⚠️ Client error:", data);
    return { data: { acknowledged: true } };
  }

  if (action === "INIT") {
    return {
      screen: "SEARCH",
      data: {
        Flight_Type: [], // init empty
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "ChipsSelector",
            name: "Flight_Type",
            label: "🛫 Book Your Flight",
            description: "Choose where you want to fly from to begin your booking:",
            required: true,
            enabled: true,
            "init-value": [], // initially empty
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
    };
  }

 if (action === "data_exchange" && trigger === "chipper") {
  const selectedType = data?.Flight_Type?.length
    ? data.Flight_Type
    : payload?.Type_Flight
    ? Array.isArray(payload.Type_Flight)
      ? payload.Type_Flight
      : [payload.Type_Flight]
    : [];

  console.log("✈️ User selected chip:", selectedType);

  return {
    screen: "SEARCH",
    data: {
      Flight_Type: selectedType, // store selected chip
    },
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "ChipsSelector",
          name: "Flight_Type",
          label: "🛫 Book Your Flight",
          description: "Choose where you want to fly from to begin your booking:",
          required: true,
          enabled: true,
          "init-value": selectedType, // preselect user’s choice
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
  };
}


  throw new Error("Unhandled endpoint request for this screen/action.");
};

module.exports = { flowWebhook, getNextScreen };
