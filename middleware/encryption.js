// src/middleware/encryption.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FlowEndpointException extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Lazy load private key
let _privateKeyObj = null;
function loadPrivateKey() {
  if (_privateKeyObj) return _privateKeyObj;

  const raw = process.env.PRIVATE_KEY || null;
  const pemPath = process.env.PRIVATE_KEY_PATH || null;

  if (raw) {
    const cleaned = raw.replace(/\\n/g, '\n').trim();
    _privateKeyObj = crypto.createPrivateKey({
      key: cleaned,
      format: 'pem',
      passphrase: process.env.PRIVATE_KEY_PASSPHRASE || undefined,
    });
    return _privateKeyObj;
  }

  if (pemPath) {
    const resolved = path.resolve(pemPath);
    if (!fs.existsSync(resolved)) throw new FlowEndpointException(500, 'PRIVATE_KEY_PATH not found');
    const pem = fs.readFileSync(resolved, 'utf8');
    _privateKeyObj = crypto.createPrivateKey({
      key: pem,
      format: 'pem',
      passphrase: process.env.PRIVATE_KEY_PASSPHRASE || undefined,
    });
    return _privateKeyObj;
  }

  throw new FlowEndpointException(500, 'Private key missing on server (set PRIVATE_KEY or PRIVATE_KEY_PATH)');
}

function isBase64(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const normalized = str.replace(/\s+/g, '');
    return Buffer.from(normalized, 'base64').toString('base64') === normalized;
  } catch (e) {
    return false;
  }
}

function decryptRequest(body) {
  if (!body) throw new FlowEndpointException(400, 'Missing request body');

  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowEndpointException(400, 'Missing encryption fields in request');
  }
  if (!isBase64(encrypted_aes_key) || !isBase64(encrypted_flow_data) || !isBase64(initial_vector)) {
    throw new FlowEndpointException(400, 'Invalid base64 fields');
  }

  // decrypt AES key with server private key (RSA-OAEP SHA256)
  let aesKey;
  try {
    const pri = loadPrivateKey();
    aesKey = crypto.privateDecrypt(
      {
        key: pri,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encrypted_aes_key, 'base64')
    );
  } catch (err) {
    console.error('AES key decrypt failed:', err && err.message);
    throw new FlowEndpointException(421, 'Failed to decrypt AES key');
  }

  // AES-GCM decrypt (ciphertext||tag, tag is last 16 bytes)
  try {
    const flowBuf = Buffer.from(encrypted_flow_data, 'base64');
    if (flowBuf.length < 16) throw new Error('ciphertext too short');
    const tag = flowBuf.subarray(flowBuf.length - 16);
    const ciphertext = flowBuf.subarray(0, flowBuf.length - 16);
    const iv = Buffer.from(initial_vector, 'base64');

    const algo = aesKey.length === 16 ? 'aes-128-gcm' : 'aes-256-gcm';
    const decipher = crypto.createDecipheriv(algo, aesKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const json = JSON.parse(plain.toString('utf8'));

    return { decryptedBody: json, aesKeyBuffer: aesKey, ivBuffer: iv };
  } catch (err) {
    console.error('AES payload decrypt failed:', err && err.message);
    throw new FlowEndpointException(500, 'Failed to decrypt AES payload');
  }
}

function encryptResponse(responseBody, recipientPublicKeyPem) {
  if (!recipientPublicKeyPem) throw new Error('recipientPublicKeyPem required');
  // AES-256-GCM
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(responseBody), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encrypted_flow_data = Buffer.concat([ciphertext, tag]).toString('base64');

  const recipientKey = crypto.createPublicKey({ key: recipientPublicKeyPem.toString().replace(/\\n/g, '\n'), format: 'pem' });
  const encrypted_aes_key = crypto.publicEncrypt(
    { key: recipientKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    aesKey
  ).toString('base64');

  return {
    encrypted_aes_key,
    initial_vector: iv.toString('base64'),
    encrypted_flow_data,
  };
}

module.exports = { decryptRequest, encryptResponse, FlowEndpointException };
