// Convert numeric ISBNs in the books collection to strings.
//
//   node scripts/migrate-isbn-to-string.js           # dry run: lists what would change
//   node scripts/migrate-isbn-to-string.js --apply   # writes the changes
//
// Back up the database (mongodump) before running with --apply.
//
// Numbers lost leading zeros, so a 9-digit value is padded back to a 10-digit ISBN-10.
// ISBN-13s start with 978/979 and never had a leading zero, so they convert as-is.
// Anything else is converted to a string unchanged and flagged for a manual check.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const apply = process.argv.includes('--apply')

const toIsbnString = (value) => {
  const digits = String(Math.trunc(value))
  if (digits.length === 9) return { isbn: digits.padStart(10, '0'), note: 'padded to ISBN-10' }
  if (digits.length === 10 || digits.length === 13) return { isbn: digits, note: '' }
  return { isbn: digits, note: `unusual length (${digits.length}), check by hand` }
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set (server/.env). Aborting.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  const books = mongoose.connection.collection('books')

  const numeric = await books
    .find({ isbn: { $type: 'number' } }, { projection: { title: 1, isbn: 1 } })
    .toArray()

  console.log(`${numeric.length} book(s) with a numeric ISBN. Mode: ${apply ? 'APPLY' : 'dry run'}\n`)

  for (const book of numeric) {
    const { isbn, note } = toIsbnString(book.isbn)
    console.log(`${book._id}  ${book.isbn} -> "${isbn}"  ${book.title}${note ? `  [${note}]` : ''}`)
    if (apply) await books.updateOne({ _id: book._id }, { $set: { isbn } })
  }

  if (!apply && numeric.length > 0) console.log('\nDry run only. Re-run with --apply to write these changes.')
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
