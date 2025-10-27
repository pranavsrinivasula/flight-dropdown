// middleware/encryption.js
const crypto = require("crypto");

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/**
 * Decrypt WhatsApp Flow Request
 * Accepts either:
 *   decryptRequest(body) OR decryptRequest(body, privateKeyPem, passphrase)
 */
const decryptRequest = (body, privateKeyPem, passphrase) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body || {};

  // Pick private key & passphrase from params or env
  const rawPrivateKey = privateKeyPem || process.env.PRIVATE_KEY;
  const rawPassphrase = typeof passphrase !== "undefined" ? passphrase : process.env.PRIVATE_KEY_PASSPHRASE || process.env.PASSPHRASE;

  if (!rawPrivateKey) {
    throw new FlowEndpointException(500, "Private key not found in environment or parameters");
  }

  // prepare RSA privateKey
  let privateKey;
  try {
    privateKey = crypto.createPrivateKey({
      key: rawPrivateKey.replace(/\\n/g, "\n"),
      passphrase: rawPassphrase,
    });
  } catch (err) {
    console.error("createPrivateKey failed:", err);
    throw new FlowEndpointException(500, "Invalid private key / passphrase");
  }

  // Decrypt AES key
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
  } catch (err) {
    console.error("privateDecrypt AES key failed:", err);
    throw new FlowEndpointException(421, "Failed to decrypt AES key.");
  }

  // Basic checks
  if (!initial_vector || !encrypted_flow_data) {
    throw new FlowEndpointException(400, "Missing initial_vector or encrypted_flow_data");
  }

  const ivBuffer = Buffer.from(initial_vector, "base64");
  const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");

  // GCM tag is typically 16 bytes
  const tagLength = 16;
  if (encryptedBuffer.length <= tagLength) {
    console.error("Encrypted buffer too short:", encryptedBuffer.length);
    throw new FlowEndpointException(422, "Encrypted data too short");
  }

  const ciphertext = encryptedBuffer.subarray(0, -tagLength);
  const authTag = encryptedBuffer.subarray(-tagLength);

  try {
    // aes-128-gcm expects 16-byte key, aes-256-gcm expects 32-byte key
    // We'll attempt aes-128-gcm first (as original code). If the key length is 32, try aes-256-gcm.
    let algorithm = null;
    if (decryptedAesKey.length === 16) algorithm = "aes-128-gcm";
    else if (decryptedAesKey.length === 32) algorithm = "aes-256-gcm";
    else {
      console.warn("Decrypted AES key has unexpected length:", decryptedAesKey.length);
      // still attempt aes-128-gcm but will likely fail
      algorithm = "aes-128-gcm";
    }

    const decipher = crypto.createDecipheriv(algorithm, decryptedAesKey, ivBuffer);
    decipher.setAuthTag(authTag);

    const decryptedJSON = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
    const decryptedBody = JSON.parse(decryptedJSON);

    // debug info
    console.debug("decryptRequest: keyLen=%d ivLen=%d cipherLen=%d tagLen=%d algorithm=%s",
      decryptedAesKey.length, ivBuffer.length, ciphertext.length, authTag.length, algorithm);

    return { decryptedBody, aesKeyBuffer: decryptedAesKey, ivBuffer };
  } catch (err) {
    console.error("Failed to decrypt payload contents:", err);
    throw new FlowEndpointException(422, "Failed to decrypt flow data.");
  }
};

/**
 * Encrypt WhatsApp Flow Response
 * - response: JS object
 * - aesKeyBuffer: Buffer (16 or 32 bytes)
 * - ivBuffer: Buffer (original IV from request)
 *
 * Note: We flip the IV bits to match sender expectations (if that is part of spec).
 * If your caller doesn't expect flipped IV, remove the flip.
 */
const encryptResponse = (response, aesKeyBuffer, ivBuffer) => {
  if (!aesKeyBuffer || !ivBuffer) {
    throw new FlowEndpointException(500, "Missing AES key or IV for encryptResponse");
  }

  // choose algorithm from key length
  const algorithm = aesKeyBuffer.length === 32 ? "aes-256-gcm" : "aes-128-gcm";

  // Flip IV (keep if platform expects flipped IV)
  const flippedIV = Buffer.from(ivBuffer.map(byte => (~byte) & 0xff));

  const cipher = crypto.createCipheriv(algorithm, aesKeyBuffer, flippedIV);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(response), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([ciphertext, authTag]).toString("base64");
};

module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
