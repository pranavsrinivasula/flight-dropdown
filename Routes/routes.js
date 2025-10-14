const express = require("express");
const router = express.Router();
const { flowController } = require("../controllers/flowController");


router.post("/webhook", flowController);

module.exports = { flowRouter: router };
