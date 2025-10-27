const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PRIVATE_KEY_PASSPHRASE || "";

// Custom error class for flow exceptions
class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/* -------------------------------------------------------------------------- */
/* 🔐 AES Encryption + Decryption Helpers                                     */
/* -------------------------------------------------------------------------- */

// Decrypt incoming request body from WhatsApp Flow
function decryptRequest(body, privateKeyPem, passphrase) {
  if (!body.encrypted_flow_data) {
    throw new FlowEndpointException(400, "Missing encrypted_flow_data in request body");
  }

  // Convert the base64 encoded envelope into a buffer
  let envelopeBuffer;
  try {
    envelopeBuffer = Buffer.from(body.encrypted_flow_data, "base64");
  } catch (err) {
    throw new FlowEndpointException(400, "Response body is not Base64 encoded");
  }

  // Extract AES key and IV using private RSA key
  const privateKey = {
    key: privateKeyPem,
    passphrase: passphrase,
  };

  // Decrypt AES key and IV (first 512 bytes = AES key, next 16 bytes = IV)
  const aesKeyLength = 256; // 256-bit key (32 bytes)
  const ivLength = 16; // 16 bytes IV

  const aesKeyBuffer = envelopeBuffer.subarray(0, aesKeyLength);
  const initialVectorBuffer = envelopeBuffer.subarray(aesKeyLength, aesKeyLength + ivLength);
  const encryptedPayload = envelopeBuffer.subarray(aesKeyLength + ivLength);

  // Decrypt AES key (if RSA encrypted)
  // if your flow sends AES key already raw, skip RSA decrypt

  // Decrypt payload with AES
  let decrypted;
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", aesKeyBuffer, initialVectorBuffer);
    decrypted = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
  } catch (err) {
    throw new FlowEndpointException(500, "AES decryption failed");
  }

  let decryptedBody;
  try {
    decryptedBody = JSON.parse(decrypted.toString());
  } catch (err) {
    throw new FlowEndpointException(500, "Invalid JSON after decryption");
  }

  return { aesKeyBuffer, initialVectorBuffer, decryptedBody };
}

// Encrypt outgoing response for WhatsApp Flow
function encryptResponse(responseBody, aesKeyBuffer, initialVectorBuffer) {
  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", aesKeyBuffer, initialVectorBuffer);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(responseBody)),
      cipher.final(),
    ]);

    // Return base64 string for the response
    return encrypted.toString("base64");
  } catch (err) {
    throw new FlowEndpointException(500, "Encryption failed");
  }
}