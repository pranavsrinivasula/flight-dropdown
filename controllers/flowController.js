const FLIGHT_LIST = [
  { id: "AI203", title: "Air India AI-203" },
  { id: "6E512", title: "IndiGo 6E-512" },
  { id: "UK811", title: "Vistara UK-811" }
];

let availableFlightsListTemp = [];
let selectedFlightOption = "";
let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    const { trigger, query, status, selected_result } = req.body;

    // Enable search fields
    if (trigger === "Enable_Search_Field") {
      isSearchEnabled = true;
      return res.json({ data: { is_search_enabled: true } });
    }

    // Submit booking
    if (trigger === "Data_Submitted") {
      console.log("Booking Data Received:", req.body);
      return res.json({ data: { status: "Booking Confirmed", message: "Flight successfully booked!" } });
    }

    // Flight search
    if (trigger === "Search_Flights") {
      const filteredFlights = FLIGHT_LIST.filter(f =>
        f.title.toLowerCase().includes((query || "").toLowerCase())
      );
      return res.json({ data: { filtered_flights: filteredFlights } });
    }

    // Flight selected
    if (trigger === "Flight_Selected" && selected_result) {
      availableFlightsListTemp = [selected_result];
      selectedFlightOption = selected_result.title;
      return res.json({
        data: {
          Available_flights_list_temp: availableFlightsListTemp,
          selected_flight_option: selectedFlightOption
        }
      });
    }

    // Default response
    return res.json({ data: { status: "active", is_search_enabled: isSearchEnabled } });

  } catch (err) {
    console.error("❌ flowController error:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { flowController };
