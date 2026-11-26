const config = require('./config')
const db = require('./db')
const app = require('./app')

const where = config.databaseUrl.startsWith('file:') ? `file ${config.databaseUrl.replace(/^file:(\/\/)?/, '')}` : config.databaseUrl.replace(/\?.*$/, '')

db.init()
    .then(() => {
        console.log(`Database ready (${where})`)
        app.listen(config.port, () => console.log(`Listening on port ${config.port}`))
    })
    .catch((err) => {
        console.error('Could not open the database:', err.message)
        process.exit(1)
    })
