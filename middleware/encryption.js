const crypto = require("crypto");

// Custom Exception
class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

const decryptRequest = (body) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Use private key from environment variable
  const privateKeyPem = process.env.PRIVATE_KEY;
  if (!privateKeyPem) {
    throw new FlowEndpointException(500, "Private key not found in environment variables");
  }

  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    passphrase: process.env.PASSPHRASE, // optional if key is encrypted
  });

  let decryptedAesKey;
  try {
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
    throw new FlowEndpointException(421, "Failed to decrypt the request. Please verify your private key.");
  }

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

const encryptResponse = (response, aesKeyBuffer, initialVectorBuffer) => {
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
