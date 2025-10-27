// routes/flightTypeRoutes.js
const express = require("express");
const router = express.Router();
const { handleFlightType } = require("../controllers/flightChipsController");

// POST /api/flight-type
router.post("/flight-type", handleFlightType);

module.exports = router;
