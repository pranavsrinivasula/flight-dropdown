const express = require("express");
const router = express.Router();
const { flowWebhook } = require("../controllers/sendDropdown");

// POST /flow-webhook/
router.post("/flow-webhook", express.raw({ type: "*/*" }), flowWebhook);

module.exports = router;
