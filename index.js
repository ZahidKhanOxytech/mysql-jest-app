const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const itemRoutes = require("./routes/item");

const app = express();

app.use(cors());

// Middleware
app.use(bodyParser.json());

// Routes
app.use("/item", itemRoutes);

app.get("/", (req, res) => {
  res.send("Working");
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
