const express = require("express");
const router = express.Router();
const { getNextScreen  } = require("../controllers/sendDropdown");

// POST /flow-webhook/
router.post("/sendDropdown",  getNextScreen );

module.exports = router;
