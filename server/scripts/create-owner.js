// Create (or reset the password of) the owner account that can add, edit and delete books.
//
//   node scripts/create-owner.js you@example.com
//      asks for the password (typed twice, hidden)
//
//   OWNER_PASSWORD='...' node scripts/create-owner.js you@example.com
//      non-interactive (Docker / first boot)
//
// Uses MONGO_URI (+ MONGO_DB_NAME) from server/.env, so it creates the owner in whichever
// database the server uses. Run it once for the dev copy and once for production.

const readline = require('readline')
const mongoose = require('mongoose')
const config = require('../config')
const User = require('../models/user')
const { hashPassword } = require('../lib/auth')

function askHidden(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
        const write = rl._writeToOutput.bind(rl)
        rl._writeToOutput = (s) => (s.startsWith(question) ? write(s) : write(''))
        rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer) })
    })
}

async function main() {
    const email = String(process.argv[2] || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        console.error('Usage: node scripts/create-owner.js you@example.com')
        process.exit(1)
    }

    let password = process.env.OWNER_PASSWORD
    if (!password) {
        password = await askHidden('Password (at least 10 characters): ')
        const again = await askHidden('Same password again: ')
        if (password !== again) { console.error('Passwords don’t match.'); process.exit(1) }
    }
    if (password.length < 10) { console.error('Use at least 10 characters.'); process.exit(1) }

    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 15000 })
    const passwordHash = await hashPassword(password)
    const existing = await User.findOne({ email })
    if (existing) {
        existing.passwordHash = passwordHash
        existing.role = 'owner'
        existing.tokenVersion = (existing.tokenVersion || 0) + 1
        await existing.save()
        console.log(`Password reset for ${email} in database "${mongoose.connection.db.databaseName}".`)
    } else {
        await User.create({ email, passwordHash, role: 'owner' })
        console.log(`Owner ${email} created in database "${mongoose.connection.db.databaseName}".`)
    }
    await mongoose.disconnect()
}

main().catch(async (err) => {
    console.error('Failed:', err.message)
    await mongoose.disconnect()
    process.exit(1)
})
