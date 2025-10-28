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
  // 1️⃣ Determine what the user clicked — take the LAST value (most recent chip)
  const clickedType =
    Array.isArray(payload?.Type_Flight)
      ? payload.Type_Flight[payload.Type_Flight.length - 1]
      : payload?.Type_Flight
      ? payload.Type_Flight
      : Array.isArray(data?.Type_Flight)
      ? data.Type_Flight[data.Type_Flight.length - 1]
      : data?.Type_Flight;

  // 2️⃣ Determine what was previously selected (if any)
  const previouslySelected =
    Array.isArray(data?.Flight_Type) && data.Flight_Type.length > 0
      ? data.Flight_Type[0]
      : null;

  console.log("✈️ clickedType:", clickedType, "previouslySelected:", previouslySelected);

  // 3️⃣ Allow only one selection at a time
  const newSelection = clickedType && clickedType !== previouslySelected ? clickedType : null;

  // 4️⃣ Return clean data
  return {
    screen: "SEARCH",
    data: {
      Flight_Type: newSelection ? [newSelection] : [],
      From_enable: !!newSelection,
    },
  };
}






  throw new Error("Unhandled endpoint request for this screen/action.");
};

module.exports = { flowWebhook, getNextScreen };
