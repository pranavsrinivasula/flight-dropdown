const express = require('express');
const router = express.Router();

const { handleFlightType } = require("../controllers/flightChipsController");

router.post('/api/chips', handleFlightType);  // endpoint to get/update chips

module.exports = router;
