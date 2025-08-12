const crypto = require("crypto");
const fs = require("fs");

let privateKeyPEM = process.env.PRIVATE_KEY;
if (!privateKeyPEM && process.env.PRIVATE_KEY_PATH) {
  privateKeyPEM = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
}
if (privateKeyPEM?.includes("\\n")) {
  privateKeyPEM = privateKeyPEM.replace(/\\n/g, "\n");
}
class FlowEndpointException extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "FlowEndpointException";
    this.statusCode = statusCode;
  }
}

/**
 * Decrypt incoming request from flow using private key and passphrase.
 * @param {Object} encryptedBody - The raw encrypted request body
 * @param {string} privateKeyPEM - Your private key PEM string
 * @param {string} passphrase - Private key passphrase (if any)
 * @returns {Object} - { aesKeyBuffer, initialVectorBuffer, decryptedBody }
 */
function decryptRequest(encryptedBody, privateKeyPEM, passphrase) {
  try {
    const { encrypted_initialisation_vector, encrypted_aes_key, encrypted_payload } = encryptedBody;

    // Decrypt AES key using RSA private key
    const privateKeyObject = crypto.createPrivateKey({ key: privateKeyPEM, passphrase });
    const aesKeyBuffer = crypto.privateDecrypt(privateKeyObject, Buffer.from(encrypted_aes_key, "base64"));

    // Decrypt IV using RSA private key
    const initialVectorBuffer = crypto.privateDecrypt(privateKeyObject, Buffer.from(encrypted_initialisation_vector, "base64"));

    // Decrypt payload using AES key and IV
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKeyBuffer, initialVectorBuffer);
    let decryptedPayload = decipher.update(encrypted_payload, "base64", "utf-8");
    decryptedPayload += decipher.final("utf-8");

    const decryptedBody = JSON.parse(decryptedPayload);
    return { aesKeyBuffer, initialVectorBuffer, decryptedBody };
  } catch (error) {
    throw new FlowEndpointException("Failed to decrypt request", 400);
  }
}

/**
 * Encrypt response JSON to send back to flow.
 * @param {Object} responseBody - Plain JSON response to encrypt
 * @param {Buffer} aesKeyBuffer - AES key from decrypted request
 * @param {Buffer} initialVectorBuffer - IV from decrypted request
 * @returns {Object} - Encrypted response object
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
  FlowEndpointException,
};


