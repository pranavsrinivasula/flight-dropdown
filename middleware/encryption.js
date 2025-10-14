const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Custom Exception for Flow Endpoint Errors
class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

// Decrypt incoming request
const decryptRequest = (body) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Updated path to your private key in 'keys' folder
  const privateKeyPath = path.join(__dirname, "keys", "private_key.pem");
  if (!fs.existsSync(privateKeyPath)) {
    throw new FlowEndpointException(
      500,
      `Private key not found at path: ${privateKeyPath}`
    );
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf-8");

  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    passphrase: process.env.PRIVATE_KEY_PASSPHRASE, // make sure this env var is set
  });

  let decryptedAesKey;
  try {
    // decrypt AES key sent by client
    decryptedAesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encrypted_aes_key, "base64")
    );
  } catch (error) {
    console.error("AES key decryption failed:", error);
    throw new FlowEndpointException(
      421,
      "Failed to decrypt the request. Please verify your private key."
    );
  }

  // decrypt flow data using AES key
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(authTag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
};

// Encrypt response data
const encryptResponse = (response, aesKeyBuffer, initialVectorBuffer) => {
  // flip initial vector bytes
  const flippedIv = Buffer.from(initialVectorBuffer.map(byte => ~byte));

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encryptedBuffer.toString("base64");
};

module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
