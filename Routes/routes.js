const express = require('express');
const router = express.Router();
const flightChipsController = require('../controllers/flightChipsController');

// Get current chip states
router.get('/', flightChipsController.getChips);

// Toggle a chip (select/deselect)
router.post('/toggle', flightChipsController.toggleChip);

module.exports = router;
