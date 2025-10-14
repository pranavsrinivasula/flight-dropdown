const crypto = require("crypto");

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "FlowEndpointException";
    this.statusCode = statusCode;
  }
}

const decryptRequest = (body) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  if (!process.env.PRIVATE_KEY)
    throw new FlowEndpointException(500, "Private key missing in .env");

  const privateKeyPem = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");

  const keyOptions = {
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  };

  if (process.env.PRIVATE_KEY_PASSPHRASE) {
    keyOptions.passphrase = process.env.PRIVATE_KEY_PASSPHRASE;
  }

  let privateKey;
  try {
    privateKey = crypto.createPrivateKey(keyOptions);
  } catch (err) {
    console.error("❌ Private key creation failed:", err);
    throw new FlowEndpointException(500, "Invalid private key or passphrase");
  }

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
    console.error("❌ AES key decryption failed:", error);
    throw new FlowEndpointException(421, "Failed to decrypt AES key");
  }

  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const ivBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    ivBuffer
  );
  decipher.setAuthTag(authTag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    ivBuffer,
  };
};

const encryptResponse = (response, aesKeyBuffer, ivBuffer) => {
  // Flip the IV for response
  const flippedIv = Buffer.from(ivBuffer.map(byte => ~byte));

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIv);

  const plaintextBuffer = Buffer.from(JSON.stringify(response), "utf-8");

  const encrypted = cipher.update(plaintextBuffer);
  const final = cipher.final();
  const authTag = cipher.getAuthTag();

  // Concatenate exactly: encrypted + final + authTag
  const encryptedBuffer = Buffer.concat([encrypted, final, authTag]);

  // Encode to Base64 WITHOUT extra characters
  return encryptedBuffer.toString("base64");
};



module.exports = { decryptRequest, encryptResponse, FlowEndpointException };
