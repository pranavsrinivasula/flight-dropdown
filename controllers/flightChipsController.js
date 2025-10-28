const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption.js");
const crypto = require("crypto");

const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "" } = process.env;

const flowWebhook = async (req, res) => {
  try {
    if (!PRIVATE_KEY) throw new Error("Private key missing in env.");

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
  const { screen, action, data = {}, flow_token, payload = {} } = decryptedBody;
  const trigger = data?.trigger || payload?.trigger;

  if (action === "ping") {
    return { data: { status: "active" } };
  }

  if (data?.error) {
    console.warn("⚠️ Client error:", data);
    return { data: { acknowledged: true } };
  }

  if (action === "INIT") {
    return {
      screen: "SEARCH",
      data: {
        Flight_Type: [],
        From_enable: false,
        To_enable: false,
        is_Flying_To_enabled: false,
        is_To_enabled: false,
        is_Search_To_enabled: false,
        is_Departure_date_enabled: false,
        is_Return_date_enabled: false,
        is_Advanced_options_enabled: false,
        is_Book_enabled: false,
        travellers: ["T1"],
        cost_centre: "18166",
        business_unit: "2306",
        min_date: "2025-07-07",
        Preferred_class_data: [{ id: "1", title: "Economy" }],
        Flying_from_data: [],
        Flying_to_data: [],
      },
    };
  }

if (action === "data_exchange" && trigger === "chipper") {
  // pick selected flight type
  const selectedType = Array.isArray(data?.Type_Flight)
    ? data.Type_Flight[0]   // take only the first one
    : data?.Type_Flight;

  console.log("✈️ User selected chip:", selectedType);
const currentSelection = Array.isArray(data?.Flight_Type)
    ? data.Flight_Type[0]
    : data?.Flight_Type;

  const newSelection =
    currentSelection === clickedType ? null : clickedType;

  console.log("✅ Final selection:", newSelection);
  return {
    screen: "SEARCH",
    data: {
      Flight_Type: selectedType ? [selectedType] : [],
      From_enable: true, // optional: enable next step
    },
  };
}



  throw new Error("Unhandled endpoint request for this screen/action.");
};

module.exports = { flowWebhook, getNextScreen };
