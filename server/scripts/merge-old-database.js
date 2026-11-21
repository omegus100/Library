// Copy books, authors and series from the older "myFirstDatabase" into the live database.
//
//   node scripts/merge-old-database.js            # dry run: shows what would be added
//   node scripts/merge-old-database.js --apply    # adds them
//   node scripts/merge-old-database.js --apply --fill-missing
//        ...also fills in series info on a live book that has none, when its duplicate in
//        the old database has it (e.g. live "Mistborn" gets "Mistborn · Book 1")
//
// Only ADDS documents (and, with --fill-missing, sets empty fields). Never deletes or overwrites.
// Safe to run more than once: anything already in the live database is skipped.
// Back up first: node scripts/backup.js && node scripts/backup.js myFirstDatabase
//
// The old database uses an earlier layout, converted like this:
//   author: ObjectId            -> author: { id, firstName, lastName }
//   bookSeries: { series, ... } -> series: { id, title, volume }
//   bookType / bookGenre        -> format / genres
//   coverImage (binary) + type  -> coverImagePath (data URL, like the current app stores)

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const SOURCE_DB = 'myFirstDatabase'
const apply = process.argv.includes('--apply')
const fillMissing = process.argv.includes('--fill-missing')

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
const authorKey = (a) => `${norm(a.firstName).replace(/\./g, '')}|${norm(a.lastName)}`

// "Mistborn: The Final Empire" duplicates a live "Mistborn" by the same author
const sameBook = (oldTitle, liveTitle) => {
  const o = norm(oldTitle)
  const l = norm(liveTitle)
  return o === l || o.startsWith(`${l}:`) || l.startsWith(`${o}:`)
}

const toDataUrl = (binary, type) => {
  if (!binary) return undefined
  const buf = Buffer.isBuffer(binary) ? binary : Buffer.from(binary.buffer ?? binary)
  return buf.length ? `data:${type || 'image/jpeg'};base64,${buf.toString('base64')}` : undefined
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set (server/.env). Aborting.')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  const live = mongoose.connection.db
  const old = mongoose.connection.client.db(SOURCE_DB)
  console.log(`From "${SOURCE_DB}" into "${live.databaseName}". Mode: ${apply ? 'APPLY' : 'dry run'}\n`)

  const [oldAuthors, oldSeries, oldBooks] = await Promise.all(
    ['authors', 'series', 'books'].map((c) => old.collection(c).find({}).toArray())
  )
  const liveAuthors = await live.collection('authors').find({}).toArray()
  const liveSeries = await live.collection('series').find({}).toArray()
  const liveBooks = await live.collection('books')
    .find({}, { projection: { title: 1, author: 1, series: 1 } }).toArray()

  // Authors: reuse a live author with the same name, else add the old one (keeping its _id)
  const authorMap = new Map() // old author _id -> { id, firstName, lastName }
  const authorsToAdd = []
  for (const a of oldAuthors) {
    const match = liveAuthors.find((l) => authorKey(l) === authorKey(a))
    if (match) {
      authorMap.set(String(a._id), { id: match._id, firstName: match.firstName, lastName: match.lastName })
      console.log(`author  = ${a.firstName} ${a.lastName} (already in live)`)
    } else {
      const doc = { _id: a._id, firstName: a.firstName.trim(), lastName: a.lastName.trim(), __v: 0 }
      authorsToAdd.push(doc)
      authorMap.set(String(a._id), { id: a._id, firstName: doc.firstName, lastName: doc.lastName })
      console.log(`author  + ${doc.firstName} ${doc.lastName}`)
    }
  }

  // Series: same title + author already live? reuse it. Else add (keeping its _id).
  const seriesMap = new Map() // old series _id -> live series id
  const seriesToAdd = []
  for (const s of oldSeries) {
    const author = authorMap.get(String(s.author))
    const match = liveSeries.find((l) => norm(l.title) === norm(s.title) && String(l.author?.id) === String(author?.id))
    if (match) {
      seriesMap.set(String(s._id), match._id)
      console.log(`series  = ${s.title} (already in live)`)
    } else {
      seriesToAdd.push({ _id: s._id, title: s.title.trim(), author: author || undefined, __v: 0 })
      seriesMap.set(String(s._id), s._id)
      console.log(`series  + ${s.title.trim()}`)
    }
  }

  // Books
  const booksToAdd = []
  const fills = []
  for (const b of oldBooks) {
    const author = authorMap.get(String(b.author))
    const title = b.title.trim()
    const dup = liveBooks.find((l) => String(l.author?.id) === String(author?.id) && sameBook(title, l.title))
    const series = b.bookSeries?.series
      ? { id: seriesMap.get(String(b.bookSeries.series)), title: b.bookSeries.title?.trim(), volume: b.bookSeries.volume }
      : undefined

    if (dup) {
      console.log(`book    = ${title} (same book as live "${dup.title}", skipped)`)
      if (series && !dup.series?.id) {
        fills.push({ _id: dup._id, title: dup.title, series })
        console.log(`          ${fillMissing ? 'will set' : 'could set (with --fill-missing)'} series on "${dup.title}": ${series.title} · Book ${series.volume}`)
      }
      continue
    }

    const doc = {
      _id: b._id,
      title,
      description: b.description?.trim() || undefined,
      publishDate: b.publishDate,
      pageCount: b.pageCount,
      createdAt: b.createdAt || new Date(),
      author,
      series,
      format: b.bookType || [],
      genres: b.bookGenre || [],
      coverImagePath: toDataUrl(b.coverImage, b.coverImageType),
      __v: 0,
    }
    Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k])
    booksToAdd.push(doc)
    const coverKb = doc.coverImagePath ? Math.round(doc.coverImagePath.length / 1024) : 0
    console.log(`book    + ${title} — ${author ? `${author.firstName} ${author.lastName}` : 'no author'}` +
      `${series ? `, ${series.title} #${series.volume}` : ''}, ${doc.format.join('/') || 'no format'}, cover ${coverKb ? `${coverKb} KB` : 'none'}`)
  }

  console.log(`\nTo add: ${authorsToAdd.length} author(s), ${seriesToAdd.length} series, ${booksToAdd.length} book(s)` +
    `${fills.length ? `; ${fills.length} series fill-in(s) ${fillMissing ? 'to apply' : 'available'}` : ''}`)

  if (!apply) {
    console.log('\nDry run only. Nothing was written. Re-run with --apply to add these.')
  } else {
    if (authorsToAdd.length) await live.collection('authors').insertMany(authorsToAdd)
    if (seriesToAdd.length) await live.collection('series').insertMany(seriesToAdd)
    if (booksToAdd.length) await live.collection('books').insertMany(booksToAdd)
    if (fillMissing) {
      for (const f of fills) {
        // Only sets series where the live book has none
        await live.collection('books').updateOne(
          { _id: f._id, $or: [{ 'series.id': { $exists: false } }, { 'series.id': null }] },
          { $set: { series: f.series } }
        )
      }
    }
    console.log('\nDone.')
  }
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Merge failed:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
