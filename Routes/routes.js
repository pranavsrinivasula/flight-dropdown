// routes.js
const express = require("express");
const router = express.Router();
const { flowWebhook } = require("../controllers/sendDropdown");

// ✅ No extra path duplication
router.post("/", flowWebhook);

module.exports = router;
