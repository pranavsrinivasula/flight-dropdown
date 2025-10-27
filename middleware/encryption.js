const crypto = require("crypto");
const fs = require("fs");

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// 1️⃣ Load private key once (from .env or file)
let privatePem;
if (process.env.PRIVATE_KEY) {
  // If key is stored directly in .env, convert \n to real newlines
  privatePem = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");
  console.log("✅ Loaded private key from environment variable");
} else if (process.env.PRIVATE_KEY_PATH) {
  // Else load from path
  privatePem = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
  console.log("✅ Loaded private key from file:", process.env.PRIVATE_KEY_PATH);
} else {
  console.error("❌ Private key not found in environment");
  throw new FlowEndpointException(500, "Private key missing on server");
}

// 2️⃣ Decrypt WhatsApp Flow request
function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowEndpointException(400, "Missing encryption fields in request");
  }

  const passphrase = process.env.PRIVATE_KEY_PASSPHRASE;
  const privateKey = crypto.createPrivateKey({ key: privatePem, passphrase });

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
    console.error("❌ AES key decryption failed:", error.message);
    throw new FlowEndpointException(421, "Failed to decrypt AES key with private key");
  }

  // AES-GCM decryption
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
    console.error("❌ Payload AES decryption failed:", error.message);
    throw new FlowEndpointException(500, "Failed to decrypt AES payload");
  }
}

// 3️⃣ Encrypt WhatsApp Flow response (✅ fixed version)
// inside middleware/encryption.js (after decryptRequest)
function isBase64(str) {
  try {
    // attempt to decode and re-encode reliably
    const decoded = Buffer.from(str, "base64");
    // empty buffer is allowed but check that re-encoding matches (helps detect trailing junk)
    return decoded.toString("base64") === str.replace(/\s+/g, "");
  } catch (e) {
    return false;
  }
}

function validateAndLogEncryption(encryptedBase64, aesKeyBuffer, ivBuffer) {
  // log sizes to debug mismatches
  console.log("🔎 Encryption debug -> aesKey length:", aesKeyBuffer.length, "iv length:", ivBuffer.length);
  // check base64 validity
  if (!isBase64(encryptedBase64)) {
    console.error("❌ encryptResponse produced invalid base64!");
    // try more diagnostics: attempt Buffer.from to see error
    try {
      Buffer.from(encryptedBase64, "base64");
      console.warn("⚠️ base64 decodes but normalized encoding mismatch");
    } catch (err) {
      console.error("❌ base64 decode error:", err.message);
    }
    // throw so caller doesn't send invalid body to WhatsApp
    throw new Error("encryptResponse produced invalid base64 payload");
  }
  console.log("✅ encryptResponse result is valid base64 (len:", encryptedBase64.length, ")");
}

// the fixed encryptResponse
function encryptResponse(responseBody, aesKeyBuffer, ivBuffer) {
  // ensure key and iv are Buffers
  if (!Buffer.isBuffer(aesKeyBuffer) || !Buffer.isBuffer(ivBuffer)) {
    throw new Error("aesKeyBuffer and ivBuffer must be Buffers");
  }

  // use same ivBuffer (no flipping)
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, ivBuffer);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseBody), "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();
  const output = Buffer.concat([encrypted, tag]).toString("base64");

  // validate before returning
  validateAndLogEncryption(output, aesKeyBuffer, ivBuffer);

  return output;
}
console.log("🔐 Decrypted AES key length:", aesKeyBuffer.length);
console.log("🔐 IV length:", ivBuffer.length);


module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
