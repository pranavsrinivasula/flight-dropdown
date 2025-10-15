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
 */
const decryptRequest = (body) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  if (!process.env.PRIVATE_KEY || !process.env.PRIVATE_KEY_PASSPHRASE) {
    throw new FlowEndpointException(500, "Private key not found in environment");
  }

  // Load RSA private key
  const privateKey = crypto.createPrivateKey({
    key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    passphrase: process.env.PRIVATE_KEY_PASSPHRASE,
  });

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
    console.error(err);
    throw new FlowEndpointException(421, "Failed to decrypt AES key.");
  }

  const ivBuffer = Buffer.from(initial_vector, "base64");
  const encryptedBuffer = Buffer.from(encrypted_flow_data, "base64");

  // Split ciphertext and authTag (GCM tag is always last 16 bytes)
  const tagLength = 16;
  const ciphertext = encryptedBuffer.subarray(0, -tagLength);
  const authTag = encryptedBuffer.subarray(-tagLength);

  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, ivBuffer);
  decipher.setAuthTag(authTag);

  const decryptedJSON = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf-8");

  const decryptedBody = JSON.parse(decryptedJSON);

  return { decryptedBody, aesKeyBuffer: decryptedAesKey, ivBuffer };
};

/**
 * Encrypt WhatsApp Flow Response
 */
const encryptResponse = (response, aesKeyBuffer, ivBuffer) => {
  // Correct IV flip: unsigned bitwise NOT
  const flippedIV = Buffer.from(ivBuffer.map(byte => (~byte) & 0xff));

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIV);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Return Base64 encoded (ciphertext + authTag)
  return Buffer.concat([ciphertext, authTag]).toString("base64");
};

module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
