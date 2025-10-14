const express = require("express");
const router = express.Router();
const { flowController } = require("../controllers/flowController");

// POST /webhook
router.post("/webhook", flowController);

// Export the router correctly
module.exports = { flowRouter: router };
