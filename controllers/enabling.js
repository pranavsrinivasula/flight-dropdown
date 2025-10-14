// app.post("/flightflow", async (req, res) => {
//   const { trigger, status } = req.body;

//   // Handle OptIn event
//   if (trigger === "Enable_Search_Field") {
//     return res.json({
//       data: {
//         is_search_enabled: true
//       }
//     });
//   }

//   // Handle Booking submit
//   if (trigger === "Data_Submitted") {
//     console.log("Booking Data Received:", req.body);
//     return res.json({
//       data: {
//         status: "Booking Confirmed",
//         message: "Flight successfully booked!"
//       }
//     });
//   }

//   // Handle Flight Search
//   if (trigger === "Search_Flights") {
//     const { query } = req.body;
//     // You can filter flights here dynamically
//     const flights = [
//       { id: "AI203", title: "Air India AI-203" },
//       { id: "6E512", title: "IndiGo 6E-512" },
//       { id: "UK811", title: "Vistara UK-811" }
//     ].filter(f => f.title.toLowerCase().includes(query.toLowerCase()));

//     return res.json({
//       data: {
//         filtered_flights: flights
//       }
//     });
//   }

//   // Default Health Check
//   if (req.body.action === "ping") {
//     return res.json({
//       data: { status: "active" }
//     });
//   }

//   res.json({ data: { message: "Unhandled trigger" } });
// });
// module.exports = { }