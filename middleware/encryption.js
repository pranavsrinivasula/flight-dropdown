const crypto = require("crypto");

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Decrypt WhatsApp Flow request
function decryptRequest(body, privatePem, passphrase) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowEndpointException(400, "Missing encryption fields in request");
  }

  // Decrypt AES key using RSA private key
  const privateKey = crypto.createPrivateKey({ key: privatePem, passphrase });
  let decryptedAesKey;
  let privatePem;
if (process.env.PRIVATE_KEY) {
  privatePem = process.env.PRIVATE_KEY.replace(/\\n/g, "\n"); // convert \n to newlines
} else {
  privatePem = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
}

  try {
    decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );
    try {
  envelopeBuffer = Buffer.from(body.encrypted_flow_data, "base64");
} catch (err) {
  console.warn("⚠️ Non-base64 payload received, treating as plain JSON for sandbox.");
  return { aesKeyBuffer: null, initialVectorBuffer: null, decryptedBody: body };
}

  } catch (error) {
    throw new FlowEndpointException(421, "Failed to decrypt AES key with private key");
  }

  // Decrypt the actual payload using AES-GCM
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const ivBuffer = Buffer.from(initial_vector, "base64");
  const tag = flowDataBuffer.subarray(-16);
  const encryptedBody = flowDataBuffer.subarray(0, -16);

  try {
    const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, ivBuffer);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encryptedBody), decipher.final()]);
    return {
      decryptedBody: JSON.parse(decrypted.toString("utf-8")),
      aesKeyBuffer: decryptedAesKey,
      ivBuffer,
    };
  } catch (error) {
    throw new FlowEndpointException(500, "Failed to decrypt AES payload");
  }
}

// Encrypt WhatsApp Flow response
function encryptResponse(responseBody, aesKeyBuffer, ivBuffer) {
  const flippedIv = Buffer.from(ivBuffer.map((b) => ~b));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseBody), "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([encrypted, tag]).toString("base64");
}

module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
