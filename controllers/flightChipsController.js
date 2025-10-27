const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // Step 1: Decrypt incoming request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(
      req.body,
      process.env.PRIVATE_KEY,
      process.env.PRIVATE_KEY_PASSPHRASE
    );

    console.log("✅ Decrypted body:", decryptedBody);

    // Step 2: Extract user input
    const flowData = decryptedBody.data || decryptedBody;
    const selectedType = flowData?.Flight_Type?.[0] || flowData?.Type_Flight?.[0] || "";

    // Step 3: Prepare response
    const responsePayload = {
      version: "7.1",
      data_api_version: "3.0",
      data: {
        Flight_Type: selectedType ? [selectedType] : [],
        is_Flying_To_enabled: !!selectedType,
      },
      actions: [
        {
          name: "update_form",
          type: "update",
          data: {
            Flight_Type: selectedType ? [selectedType] : [],
            is_Flying_To_enabled: !!selectedType,
          },
        },
      ],
    };

    // Step 4: Encrypt response
    const encrypted = encryptResponse(responsePayload, aesKeyBuffer, ivBuffer);

    // Step 5: Send encrypted response
    res.status(200).json({ encrypted_flow_data: encrypted });
  } catch (err) {
    console.error("❌ Error in handleFlightType:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
