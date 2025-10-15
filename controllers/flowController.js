const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

const flightFlowController = async (req, res) => {
  try {
    // STEP 1: Decrypt incoming payload
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);

    console.log("Decrypted flow data:", decryptedBody);

    const userSelection = decryptedBody?.data?.selected_flight_option || null;

    // STEP 2: Base response data
    let responsePayload = {
      version: "7.1",
      data: {
        show_search_input: false,
        show_search_link: false,
        message: "Please select a flight to enable search",
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextSubheading", text: "🛫 Book Your Flight" },
          { type: "TextCaption", text: "Choose where you want to fly from to begin your booking:" },
          { type: "Dropdown", label: "Select a Flight", name: "selected_flight_option", required: true },
        ],
      },
    };

    // STEP 3: If user selected a valid flight, enable input + search link
    if (userSelection && userSelection.trim() !== "") {
      responsePayload = {
        version: "7.1",
        data: {
          show_search_input: true,
          show_search_link: true,
          message: `You selected: ${userSelection}. Search enabled.`,
        },
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextSubheading", text: "🛫 Book Your Flight" },
            { type: "TextCaption", text: "You can now search for available flights below:" },
            { type: "TextInput", label: "Enter Flight Name", name: "search_query", "input-type": "text" },
            {
              type: "EmbeddedLink",
              text: "🔎 Go to Search & Select Flight",
              on_click_action: {
                name: "navigate",
                next: { type: "screen", name: "FINISH" },
              },
            },
          ],
        },
      };
    }

    // STEP 4: Encrypt response
    const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, ivBuffer);

    // STEP 5: Send encrypted response
    return res.status(200).json({ encrypted_response: encryptedResponse });

  } catch (err) {
    console.error("❌ flowController error:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || "Internal Server Error",
    });
  }
};

module.exports = { flightFlowController };
