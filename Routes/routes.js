const express = require("express");
const router = express.Router();
const { flightFlowController } = require("../controllers/flowController");

// POST /api/flow/booking or /webhook (depending on your endpoint)
router.post("/webhook", flightFlowController);

// ✅ Export router directly
module.exports = router;
