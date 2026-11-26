// Create (or reset the password of) the owner account that can add, edit and delete books.
//
//   node scripts/create-owner.js you@example.com
//      asks for the password (typed twice, hidden)
//
//   OWNER_PASSWORD='...' node scripts/create-owner.js you@example.com
//      non-interactive
//
// Uses DATABASE_URL (default: the local data/library.db). In Docker:
//   docker exec -it library node scripts/create-owner.js you@example.com

const readline = require('readline')
const config = require('../config')
const db = require('../db')
const { users: Users } = require('../db/repos')
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

    await db.init()
    const passwordHash = await hashPassword(password)
    const existing = await Users.byEmail(email)
    if (existing) {
        await Users.setPassword(existing._id, passwordHash)
        console.log(`Password reset for ${email}.`)
    } else {
        await Users.create({ email, passwordHash, role: 'owner' })
        console.log(`Owner ${email} created.`)
    }
    console.log(`Database: ${config.databaseUrl.replace(/\?.*$/, '')}`)
    db.close()
}

main().catch((err) => {
    console.error('Failed:', err.message)
    process.exit(1)
})
