const express = require('express');
const router = express.Router();

const { getChips } = require("../controllers/flightChipsController");

router.post('/api/chips', getChips);  // endpoint to get/update chips

module.exports = router;
