require('dotenv').config();
const express = require('express');
const cors = require('cors');
const vesselRoutes = require('./src/routes/vesselRoutes');
const weatherRoutes = require('./src/routes/weatherRoutes');
const systemRoutes = require('./src/routes/systemRoutes');
const { startAISStream } = require('./src/services/aisstream');

const app = express();
app.use(cors());
app.use('/api', vesselRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/system', systemRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startAISStream();
});
