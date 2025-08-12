const express = require("express");
const router = express.Router();

const { flowWebhook } = require("../controllers/sendDropdown");

router.post("/flow-webhook", flowWebhook);


module.exports = router;
