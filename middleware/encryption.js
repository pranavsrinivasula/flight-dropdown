// middleware/encryption.js
// Robust encryption/decryption helpers for WhatsApp Flow style envelope.
// Exports: decryptRequest(body) -> { decryptedBody, aesKeyBuffer, ivBuffer }
//          encryptResponse(responseBody, recipientPublicKey) -> { encrypted_aes_key, initial_vector, encrypted_flow_data }

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Lazy loader for private key (so module load doesn't crash)
let _privatePem = null;
let _privatePassphrase = null;
let _privateKeyObject = null;

function loadPrivateKey() {
  if (_privateKeyObject) return _privateKeyObject;

  // order: env PRIVATE_KEY -> PRIVATE_KEY_PATH
  const rawPem = process.env.PRIVATE_KEY;
  const pemPath = process.env.PRIVATE_KEY_PATH;

  if (rawPem) {
    // support escaped newlines in env
    const cleaned = rawPem.replace(/\\n/g, '\n').trim();
    _privatePem = cleaned;
    _privatePassphrase = process.env.PRIVATE_KEY_PASSPHRASE || undefined;
  } else if (pemPath) {
    const resolved = path.resolve(pemPath);
    if (!fs.existsSync(resolved)) {
      throw new FlowEndpointException(500, 'PRIVATE_KEY_PATH not found: ' + resolved);
    }
    _privatePem = fs.readFileSync(resolved, 'utf8');
    _privatePassphrase = process.env.PRIVATE_KEY_PASSPHRASE || undefined;
  } else {
    throw new FlowEndpointException(500, 'Private key missing on server (set PRIVATE_KEY or PRIVATE_KEY_PATH)');
  }

  _privateKeyObject = crypto.createPrivateKey({
    key: _privatePem,
    format: 'pem',
    passphrase: _privatePassphrase,
  });

  return _privateKeyObject;
}

// helper to detect valid base64
function isBase64(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const normalized = str.replace(/\s+/g, '');
    return Buffer.from(normalized, 'base64').toString('base64') === normalized;
  } catch (e) {
    return false;
  }
}

/**
 * Decrypt incoming envelope:
 * body must contain: encrypted_aes_key (base64), encrypted_flow_data (base64), initial_vector (base64)
 * encrypted_flow_data is expected to be ciphertext||tag (tag appended at end, 16 bytes)
 */
function decryptRequest(body) {
  if (!body) throw new FlowEndpointException(400, 'Missing request body');

  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowEndpointException(400, 'Missing encryption fields in request');
  }

  if (!isBase64(encrypted_aes_key) || !isBase64(encrypted_flow_data) || !isBase64(initial_vector)) {
    throw new FlowEndpointException(400, 'Invalid base64 fields');
  }

  // 1) decrypt AES key with server private key (RSA-OAEP + SHA256)
  let aesKeyBuffer;
  try {
    const privateKey = loadPrivateKey();
    aesKeyBuffer = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted_aes_key, 'base64')
    );
  } catch (err) {
    console.error('❌ AES key decryption failed:', err && err.message);
    throw new FlowEndpointException(421, 'Failed to decrypt AES key with private key');
  }

  // 2) AES-GCM decrypt (we expect tag appended to ciphertext)
  try {
    const flowDataBuf = Buffer.from(encrypted_flow_data, 'base64');
    if (flowDataBuf.length < 16) throw new Error('ciphertext too short (no auth tag)');

    const tag = flowDataBuf.subarray(flowDataBuf.length - 16);
    const ciphertext = flowDataBuf.subarray(0, flowDataBuf.length - 16);
    const ivBuf = Buffer.from(initial_vector, 'base64');

    // Accept aesKeyBuffer of 16 or 32 bytes. Choose algorithm accordingly.
    const algo = aesKeyBuffer.length === 16 ? 'aes-128-gcm' : 'aes-256-gcm';

    const decipher = crypto.createDecipheriv(algo, aesKeyBuffer, ivBuf);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decryptedJson = JSON.parse(decrypted.toString('utf8'));

    return { decryptedBody: decryptedJson, aesKeyBuffer, ivBuffer: ivBuf };
  } catch (err) {
    console.error('❌ Payload AES decryption failed:', err && err.message);
    throw new FlowEndpointException(500, 'Failed to decrypt AES payload');
  }
}

/**
 * Encrypt responseBody and prepare envelope fields:
 * - generate a fresh AES key (32 bytes by default)
 * - encrypt payload with AES-GCM (iv 12 bytes)
 * - encrypt AES key with recipientPublicKey (RSA-OAEP SHA256) -> encrypted_aes_key
 * Returns object with base64 fields { encrypted_aes_key, initial_vector, encrypted_flow_data }
 *
 * recipientPublicKey must be PEM string (or Buffer) — e.g. WhatsApp public key.
 */
function encryptResponse(responseBody, recipientPublicKeyPem) {
  if (!recipientPublicKeyPem) {
    throw new Error('recipientPublicKeyPem is required to encrypt response');
  }

  // generate AES key (32 bytes => AES-256-GCM)
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(responseBody), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // append tag to ciphertext (same format as incoming expected)
  const encryptedFlowData = Buffer.concat([ciphertext, tag]).toString('base64');

  // encrypt the AES key with recipient public key (RSA-OAEP + SHA256)
  const recipientKeyObj = crypto.createPublicKey({
    key: recipientPublicKeyPem.toString().replace(/\\n/g, '\n'),
    format: 'pem',
  });

  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: recipientKeyObj,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  ).toString('base64');

  // return envelope
  return {
    encrypted_aes_key: encryptedAesKey,
    initial_vector: iv.toString('base64'),
    encrypted_flow_data: encryptedFlowData,
  };
}

module.exports = { decryptRequest, encryptResponse, FlowEndpointException };
