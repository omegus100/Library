const mongoose = require('mongoose')
const config = require('./config')
const app = require('./app')

mongoose.connect(config.mongoUri, { dbName: config.mongoDbName })
    .then(() => console.log(`MongoDB connected (database "${mongoose.connection.db.databaseName}")`))
    .catch((err) => console.error('MongoDB connection error:', err.message))

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))
