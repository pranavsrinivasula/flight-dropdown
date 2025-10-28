// routes/flightTypeRoutes.js
const express = require("express");
const router = express.Router();
const { flowWebhook } = require("../controllers/flightChipsController");

// POST /api/flight-type
router.post("/api/flight-type", flowWebhook);
module.exports = router;
