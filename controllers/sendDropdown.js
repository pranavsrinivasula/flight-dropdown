const express = require("express");
const app = express();

app.use(express.json());



const SCREEN_RESPONSE = {
    Flight_Booking: {
        screen: "FLIGHT_BOOKING_SCREEN",
        data: {
            trip_types: [
                {
                    id: "HYD TO MUMBAI",
                    title: "HYD TO MUMBAI",
                },
                {
                    id: "HYD TO GOA",
                    title: "HYD TO GOA",
                }
            ]
        }
    },
    SUMMARY: {
        screen: "SUMMARY_SCREEN",
        data: {
            selected_flight: "Hyderabad to Delhi - Economy Class\nMon Jan 01 2024 at 11:30",
            details:
                "Passenger: PRANAV\nEmail: john@example.com\nPhone: 123456789\n\nWindow seat, vegetarian meal",
            origin: "Hyderabad",
            destination: "Delhi",
            date: "2024-01-01",
            time: "11:30",
            passenger_name: "John Doe",
            email: "john@example.com",
            phone: "123456789",
            extra_preferences: "Window seat, vegetarian meal"
        }
    }
};
module.exports = {
    SCREEN_RESPONSE
};
