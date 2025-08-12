const express = require("express");
const router = express.Router();

const { flowWebhook } = require("../controllers/sendDropdown");

// router.post("/flow-webhook", flowWebhook);
router.post("/flow-webhook", express.raw({ type: "*/*" }), flowWebhook);

module.exports = router;
