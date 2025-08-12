// routes/flowRoutes.js
const express = require("express");
const router = express.Router();
const { SCREEN_RESPONSE } = require("../controllers/sendDropdown");


router.post("/flow-webhook", (req, res) => {
    const { action, screen, data } = req.body;

    console.log("Incoming Request:", req.body);


    if (action === "INIT") {
        return res.json(SCREEN_RESPONSE.Flight_Booking.data);
    }

    if (action === "data_exchange" && screen === "FLIGHT_BOOKING_SCREEN") {
        // In a real case, dynamically build SUMMARY from user selection
        return res.json(SCREEN_RESPONSE.SUMMARY);
    }

    return res.json({ data: { message: "No matching action" } });
});

module.exports = router;
