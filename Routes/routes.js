const express = require("express");
const router = express.Router();
const { sendDropdown } = require("../controllers/sendDropdown");

// POST /flow-webhook/
router.post("/sendDropdown",  sendDropdown);

module.exports = router;
