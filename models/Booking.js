const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    phone_number: {
      type: String,
      default: "6301015711", 
    },
    from_city: {
      type: String,
      required: true,
      trim: true,
    },
    to_city: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: String,
      required: true,
      trim: true,
    },
    end_date: {
      type: String,
      required: true,
      trim: true,
    }
  },
  {
    timestamps: true 
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
