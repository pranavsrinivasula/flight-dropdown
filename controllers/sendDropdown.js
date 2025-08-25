const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;
const Booking = require("../models/Booking");

 
const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: [
        { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
        { id: "HYD_TO_GOA", title: "HYD TO GOA" }
      ],
      cities: [
        { id: "HYD", title: "Hyderabad" },
        { id: "MUM", title: "Mumbai" },
        { id: "GOA", title: "Goa" }
      ]
    }
  }
};



const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) throw new Error("Private key is empty");

  if (!isRequestSignatureValid(req)) return res.status(432).send();

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", JSON.stringify(decryptedBody, null, 2));

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", JSON.stringify(screenResponse, null, 2));

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

const formatDate = (date) => date.toISOString().split("T")[0];


const getNextScreen = async (decryptedBody) => {
  const { action, screen, data } = decryptedBody;

  if (action === "ping") {
    return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };
  }

  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);

  if (action === "INIT") {
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
        calendar: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate),
          init_value: {
            start_date: formatDate(today),
            end_date: formatDate(maxDate)
          }
        }
      }
    };
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
      
   
        return {
          screen: "SUMMARY_SCREEN",
          data: {
            from_city: data.from_city || "Not selected",
            to_city: data.to_city || "Not selected",
            Startdate: data.Startdate || "Not selected",
            Enddate: data.Enddate || "Not selected"
          }
        };

              case "SUMMARY_SCREEN":
              try {
                await Booking.create({
                  from_city: data.from_city,
                  to_city: data.to_city,     
                  start_date: data.Startdate,  
                  end_date: data.Enddate       
                 
                });
                console.log("✅ Booking saved successfully!");
              } catch (err) {
                console.error("❌ Error saving booking:", err);
              }

              return {
                screen: "TERMINAL_SCREEN",
                data: {
                  message: "Booking flow complete",
                  trip_summary: {
                    from_city: data.from_city,
                    to_city: data.to_city,
                    Startdate: data.Startdate,
                    Enddate: data.Enddate
                  }
                }
  };
            default:
                return SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN;
            }
          }

  return {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
      cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
      calendar: {
        min_date: formatDate(today),
        max_date: formatDate(maxDate),
        init_value: {
          start_date: formatDate(today),
          end_date: formatDate(maxDate)
        },
        
      }
    }
  };
};



module.exports = { flowWebhook, getNextScreen };
