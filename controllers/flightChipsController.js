const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // Step 1: Decrypt incoming request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);

    console.log("Decrypted body:", decryptedBody);

    // Extract flow data
    const flowData = decryptedBody.data || {};
    const userSelectedType = flowData?.Type_Flight?.[0] || ""; // if user selected chip

    // Step 2: Prepare updated response data
    const responsePayload = {
      version: "7.1",
      data_api_version: "3.0",
      data: {
        Flight_Type: userSelectedType ? [userSelectedType] : [], // if selected -> keep in init value, else empty
        is_Flying_To_enabled: !!userSelectedType, // enable next field if user selected something
      },
      actions: [
        {
          name: "update_form",
          type: "update",
          data: {
            Flight_Type: userSelectedType ? [userSelectedType] : [],
          },
        },
      ],
    };

    // Step 3: Encrypt response
    const encrypted = encryptResponse(responsePayload, aesKeyBuffer, ivBuffer);

    // Step 4: Send encrypted response
    res.status(200).json({
      encrypted_flow_data: encrypted,
      success: true,
    });
  } catch (err) {
    console.error("Error in handleFlightType:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
