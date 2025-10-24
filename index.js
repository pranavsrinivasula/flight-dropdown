const express = require('express');
const app = express();
const flightChipsRoutes = require('./Routes/routes');

app.use(express.json());

// Mount flight chips API
app.use("/", flightChipsRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
