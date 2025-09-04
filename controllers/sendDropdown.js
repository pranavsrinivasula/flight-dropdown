const getNextScreen = async ({ action, screen, data }) => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  const baseData = {
    trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.trip_types,
    cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.cities,
    calendar: { min_date: formatDate(today), max_date: formatDate(maxDate) },
    is_age_enabled: false,
    is_to_city_enabled: false
  };

  if (action === "ping") return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };

  if (action === "INIT" || screen === "FLIGHT_BOOKING_SCREEN") {
    return { screen: "FLIGHT_BOOKING_SCREEN", data: baseData };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        // ✅ Handle Verify Button
        if (data.verify_name) {
          if (!data.name) {
            return {
              screen: "FLIGHT_BOOKING_SCREEN",
              data: { ...baseData, error: "Please enter Name before verifying" }
            };
          }
          return {
            screen: "FLIGHT_BOOKING_SCREEN",
            data: { ...baseData, is_age_enabled: true, is_to_city_enabled: !!data.from_city }
          };
        }

        // Continue button → move to summary
        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: data.from_city || "",
            to_city: data.to_city || "",
            Startdate: data.Startdate || "",
            Enddate: data.Enddate || "",
            name: data.name || "",
            age: data.age || ""
          }
        };

      case "SUMMARY_SCREEN":
        try {
          if (!data.Startdate) throw new Error("Startdate is required");
          if (data.Enddate && new Date(data.Enddate) < new Date(data.Startdate)) {
            throw new Error("Enddate cannot be before Startdate");
          }

          await Booking.create({
            from_city: data.from_city,
            to_city: data.to_city,
            start_date: data.Startdate,
            end_date: data.Enddate || data.Startdate,
            name: data.name,
            age: data.age,
            phone_number: "6301015711"
          });
        } catch (err) {
          console.error(err.message);
          return {
            screen: "FLIGHT_BOOKING_SCREEN",
            data: { ...baseData, error: err.message }
          };
        }

        return {
          screen: "TERMINAL_SCREEN",
          data: {
            message: "Booking flow complete",
            trip_summary: { ...data }
          }
        };
    }
  }

  return { screen: "FLIGHT_BOOKING_SCREEN", data: baseData };
};
