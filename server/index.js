const express = require('express')
const mongoose = require('mongoose')
const app = express()
const port = process.env.PORT || 5000
const path = require('path')
const axios = require('axios')
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.json({ limit: '10mb' })); // Adjust the limit as needed
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// MongoDB connection URI (replace with your actual URI)
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase';

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err))

//Routes for React server 
const bookRouter = require('./routes/books')
const authorRouter = require('./routes/authors')
const seriesRouter = require('./routes/series')

// Proxy route to fetch images from external URLs
app.get('/proxy', async (req, res) => {
  const { url } = req.query; // Get the URL to proxy from the query parameter
  console.log('Proxy request received for URL:', url)
  try {
      const response = await axios.get(url, { responseType: 'arraybuffer' }); // Fetch the image
      res.set('Content-Type', response.headers['content-type']); // Set the correct content type
      res.set('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
      res.send(response.data); // Send the image data back to the client
  } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).send('Error fetching image');
  }
})

app.use('/api/books', bookRouter) 
app.use('/api/authors', authorRouter)
app.use('/api/series', seriesRouter)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))


// console.log that your server is up and running
app.listen(port, () => console.log(`Listening on port ${port}`))