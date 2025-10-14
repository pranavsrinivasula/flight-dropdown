const crypto = require("crypto");

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

const decryptRequest = (body) => {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  if (!process.env.PRIVATE_KEY || !process.env.PRIVATE_KEY_PASSPHRASE) {
    throw new FlowEndpointException(500, "Private key not found in environment");
  }

  const privateKey = crypto.createPrivateKey({
    key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    passphrase: process.env.PRIVATE_KEY_PASSPHRASE,
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
  } catch (err) {
    console.error(err);
    throw new FlowEndpointException(
      421,
      "Failed to decrypt AES key. Verify private key."
    );
  }

  const ivBuffer = Buffer.from(initial_vector, "base64");
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");

  const TAG_LENGTH = 16;
  const encryptedFlowBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-128-gcm", decryptedAesKey, ivBuffer);
  decipher.setAuthTag(authTag);

  const decryptedJSON = Buffer.concat([decipher.update(encryptedFlowBody), decipher.final()]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSON),
    aesKeyBuffer: decryptedAesKey,
    ivBuffer,
  };
};

const encryptResponse = (response, aesKeyBuffer, ivBuffer) => {
  // Flip IV
  const flippedIV = Buffer.from(ivBuffer.map(byte => ~byte));

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKeyBuffer, flippedIV);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(response), "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([encrypted, authTag]).toString("base64");
};

module.exports = {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
};
