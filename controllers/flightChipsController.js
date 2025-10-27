const { decryptRequest, encryptResponse } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    console.log("Decrypted body:", decryptedBody);

    const flowData = decryptedBody.data || decryptedBody || {};
    const userSelectedType = flowData?.Flight_Type?.[0] || flowData?.Type_Flight?.[0] || "";

    const responsePayload = {
      version: "7.1",
      data_api_version: "3.0",
      data: {
        Flight_Type: userSelectedType ? [userSelectedType] : [],
        is_Flying_To_enabled: !!userSelectedType,
      },
      actions: [
        {
          name: "update_form",
          type: "update",
          data: {
            Flight_Type: userSelectedType ? [userSelectedType] : [],
            is_Flying_To_enabled: !!userSelectedType,
          },
        },
      ],
    };

    const encrypted = encryptResponse(responsePayload, aesKeyBuffer, ivBuffer);
    res.status(200).json({ encrypted_flow_data: encrypted, success: true });
  } catch (err) {
    console.error("Error in handleFlightType:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
