const crypto = require("crypto");

class FlowEndpointException extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "FlowEndpointException";
    this.statusCode = statusCode;
  }
}

const APP_SECRET = process.env.APP_SECRET;

/**
 * Validate incoming request signature
 */
function isRequestSignatureValid(req) {
  const expectedSignature = req.get("X-Hub-Signature-256");
  if (!expectedSignature) return false;

  const hmac = crypto.createHmac("sha256", APP_SECRET);
  hmac.update(req.rawBody); // now defined

  const actualSignature = `sha256=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(actualSignature),
    Buffer.from(expectedSignature)
  );
}



/**
 * Decrypt request from Flow
 */
function decryptRequest(encryptedBody, PRIVATE_KEY, PASSPHRASE) {
  try {
    const { encrypted_initialisation_vector, encrypted_aes_key, encrypted_payload } = encryptedBody;

    const privateKeyObject = crypto.createPrivateKey({ key: PRIVATE_KEY, passphrase: PASSPHRASE });
    const aesKeyBuffer = crypto.privateDecrypt(privateKeyObject, Buffer.from(encrypted_aes_key, "base64"));
    const initialVectorBuffer = crypto.privateDecrypt(privateKeyObject, Buffer.from(encrypted_initialisation_vector, "base64"));

    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKeyBuffer, initialVectorBuffer);
    let decryptedPayload = decipher.update(encrypted_payload, "base64", "utf-8");
    decryptedPayload += decipher.final("utf-8");

    return { aesKeyBuffer, initialVectorBuffer, decryptedBody: JSON.parse(decryptedPayload) };
  } catch (error) {
    throw new FlowEndpointException("Failed to decrypt request", 400);
  }
}

/**
 * Encrypt response to Flow
 */
function encryptResponse(responseBody, aesKeyBuffer, initialVectorBuffer) {
  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKeyBuffer, initialVectorBuffer);
    let encrypted = cipher.update(JSON.stringify(responseBody), "utf8", "base64");
    encrypted += cipher.final("base64");

    return { encrypted_payload: encrypted };
  } catch (error) {
    throw new FlowEndpointException("Failed to encrypt response", 500);
  }
}

module.exports = {
  decryptRequest,
  encryptResponse,
  isRequestSignatureValid,
  FlowEndpointException
};
